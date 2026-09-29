import {BUILDINGS,UNIT_CLASSES,REGIONS,createInitialState,normalizeState,buildingCost,canAfford,resourceCap,armyPower,unitStats,strongestUnit,recruit,upgradeBuilding,expeditionOutcome,resolveSeasonWar,randomEvent,seasonWarPower,updateCapitalLocks} from "./src/fantasy-core.js";

const SAVE_KEY="realmfront-save-v2";
let state=normalizeState(loadRaw());
let activeTab="build",selectedTeam=new Set(state.units.slice(0,4).map(u=>u.id)),animT=0,lastFrame=0,soundOn=true;
const qaMode=new URLSearchParams(location.search).has("qa");
const spriteSheets={characters:new Image(),buildings:new Image(),regions:new Image(),vfx:new Image()};
spriteSheets.characters.src="assets/characters.svg";
spriteSheets.buildings.src="assets/buildings.svg";
spriteSheets.regions.src="assets/regions.svg";
spriteSheets.vfx.src="assets/vfx.svg";
const charSpriteIndex={Warrior:0,Archer:1,Mage:2,Cleric:3,Knight:4,Rogue:5};
const buildingSpriteIndex={townhall:0,house:1,barracks:2,archery:3,chapel:4,blacksmith:5,warehouse:6,training:7,shrine:8,watchtower:9};
const cityFx=[],q=s=>document.querySelector(s),panel=q("#panelContent"),canvas=q("#cityCanvas"),ctx=canvas.getContext("2d"),modal=q("#modal"),modalBody=q("#modalBody");

function loadRaw(){try{return JSON.parse(localStorage.getItem(SAVE_KEY))}catch{return null}}
function persist(){localStorage.setItem(SAVE_KEY,JSON.stringify(state))}
function save(){persist();toast("Game saved");sound("click")}
function money(n){return Math.round(n).toLocaleString()}
function costText(c){return Object.entries(c).filter(([,v])=>v>0).map(([k,v])=>k[0].toUpperCase()+k.slice(1)+" "+v).join(" · ")}
function toast(msg){const e=q("#toast");e.textContent=msg;e.classList.add("show");clearTimeout(toast.t);toast.t=setTimeout(()=>e.classList.remove("show"),2200)}
function floatText(text,kind="good"){const e=document.createElement("div");e.className="float-text "+kind;e.textContent=text;q("#floatingLayer").appendChild(e);setTimeout(()=>e.remove(),1200)}
function openModal(html){modalBody.innerHTML=html;modal.classList.remove("hidden")}
function closeModal(){modal.classList.add("hidden");modalBody.innerHTML=""}
q("#closeModal").addEventListener("click",closeModal);modal.addEventListener("click",e=>{if(e.target===modal)closeModal()});

function sound(type){
  if(!soundOn)return;
  try{
    const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;
    const ac=sound.ac||(sound.ac=new AC()),o=ac.createOscillator(),g=ac.createGain(),now=ac.currentTime;
    const map={click:[420,.035],build:[180,.09],upgrade:[520,.12],hit:[120,.045],arrow:[680,.035],magic:[840,.08],victory:[660,.18],war:[90,.28]};
    const [freq,dur]=map[type]||map.click;o.frequency.setValueAtTime(freq,now);if(type==="victory")o.frequency.exponentialRampToValueAtTime(960,now+dur);g.gain.setValueAtTime(.05,now);g.gain.exponentialRampToValueAtTime(.001,now+dur);o.connect(g);g.connect(ac.destination);o.start(now);o.stop(now+dur);
  }catch{}
}

document.querySelectorAll(".tab").forEach(b=>b.addEventListener("click",()=>{activeTab=b.dataset.tab;document.querySelectorAll(".tab").forEach(x=>x.classList.toggle("active",x===b));renderPanel();sound("click")}));
q("#saveBtn").addEventListener("click",save);
q("#newBtn").addEventListener("click",()=>openModal('<div class="result-big"><h2>Start a new campaign?</h2><p>Your current save will be replaced.</p><button class="btn danger" id="confirmNew">Start New Game</button></div>'));
q("#helpBtn").addEventListener("click",showGuide);
q("#soundBtn").addEventListener("click",()=>{soundOn=!soundOn;q("#soundBtn").textContent=soundOn?"Sound On":"Sound Off";q("#soundBtn").setAttribute("aria-pressed",String(soundOn));if(soundOn)sound("click")});
q("#warBtn").addEventListener("click",showSeasonWar);
document.addEventListener("click",e=>{if(e.target?.id==="confirmNew"){resetGame();closeModal()}});

function resetGame(){localStorage.removeItem(SAVE_KEY);state=createInitialState();selectedTeam=new Set(state.units.map(u=>u.id));activeTab="build";document.querySelectorAll(".tab").forEach(b=>b.classList.toggle("active",b.dataset.tab==="build"));renderAll();toast("New campaign started")}
function renderAll(){ensureSelections();updateCapitalLocks(state);renderHud();renderPanel();updateWarButton();persist();checkEnd()}
function renderHud(){
  const cap=resourceCap(state),icons={gold:"◆",wood:"▥",stone:"⬟",crystal:"✦"};
  q("#resourceHud").innerHTML=["gold","wood","stone","crystal"].map(k=>'<div class="res"><small>'+icons[k]+' '+k.toUpperCase()+'</small><b>'+money(state.resources[k])+' / '+money(cap)+'</b></div>').join("")+'<div class="res"><small>⚔ ARMY</small><b>'+money(armyPower(state))+'</b></div>';
  q("#monthLabel").textContent="Year "+state.year+" · Month "+state.month;q("#seasonLabel").textContent="Season "+state.season;
  q("#cityLevel").textContent="Town Hall Lv."+state.buildings.townhall;
  const pos=(state.month-1)%3;q("#warCountdown").textContent=state.warReady?"READY":(3-pos)+" month"+(3-pos===1?"":"s");
  q("#warAlert").classList.toggle("hidden",!state.warReady);
}
function updateWarButton(){q("#warBtn").disabled=!state.warReady||state.gameOver;q("#warBtn").textContent=state.warReady?"Season War Ready":"Season War"}
function tutorialBox(){
  const steps=[["Raise Dawnkeep","Upgrade or construct a building."],["Grow the army","Recruit at least one new unit."],["Send an expedition","Choose 3-5 units and clear Green Fields."],["Prepare for war","Improve the city and army before the Season War."],["Conquer the frontier","Win Season Wars and bring down both capitals."]];
  const s=steps[Math.min(state.tutorial,steps.length-1)];return '<div class="tutorial"><b>Guide '+(Math.min(state.tutorial+1,5))+'/5 — '+s[0]+'</b><br>'+s[1]+'</div>';
}
function renderPanel(){({build:renderBuild,army:renderArmy,expedition:renderExpedition,territory:renderTerritory}[activeTab]||renderBuild)()}

function renderBuild(){
  panel.innerHTML=tutorialBox()+'<h2 class="section-title">Settlement Development</h2><div class="card-grid">'+Object.entries(BUILDINGS).map(([k,b])=>{
    const lvl=state.buildings[k]||0,c=buildingCost(k,lvl||1),max=lvl>=b.max,aff=canAfford(state.resources,c);
    return '<div class="card"><div class="row"><div><h3>'+b.name+' <span class="pill">Lv.'+lvl+'</span></h3><p>'+b.desc+'</p><span class="cost">'+(max?"MAX LEVEL":costText(c))+'</span></div><button class="btn '+(aff?"good":"")+'" data-build="'+k+'" '+(max||!aff?"disabled":"")+'>'+(lvl?"Upgrade":"Build")+'</button></div></div>'
  }).join("")+'</div>';
  panel.querySelectorAll("[data-build]").forEach(b=>b.addEventListener("click",()=>{
    const key=b.dataset.build,r=upgradeBuilding(state,key);if(r.ok){state.tutorial=Math.max(state.tutorial,1);cityFx.push({type:"build",key,t:performance.now()});floatText((state.buildings[key]===1?"Built ":"Upgraded ")+BUILDINGS[key].name,state.buildings[key]>1?"magic":"good");sound(state.buildings[key]>1?"upgrade":"build");renderAll()}else toast(r.reason)
  }));
}
function renderArmy(){
  const pop=4+(state.buildings.house||0)*3+(state.buildings.townhall||0);
  panel.innerHTML=tutorialBox()+'<div class="row"><h2 class="section-title">Army</h2><span class="pill">'+state.units.length+' / '+pop+' population</span></div><div class="stack">'+state.units.map(u=>{const s=unitStats(state,u),cl=u.cls.toLowerCase();return '<div class="card unit-line"><div class="avatar '+cl+'"></div><div><b>'+u.cls+' #'+u.id+'</b><p>Lv.'+u.level+' · XP '+u.xp+' · Power '+s.power+'</p></div><label><input type="checkbox" data-team="'+u.id+'" '+(selectedTeam.has(u.id)?"checked":"")+'> Team</label></div>'}).join("")+'</div><h2 class="section-title">Recruit</h2><div class="card-grid">'+Object.entries(UNIT_CLASSES).map(([cls,c])=>{const lvl=state.buildings[c.need]||0,ok=lvl>=(c.needLevel||1)&&canAfford(state.resources,c.cost)&&state.units.length<pop;return '<div class="card"><div class="row"><div><h3>'+cls+'</h3><p>'+c.need+' Lv.'+(c.needLevel||1)+' · '+costText(c.cost)+'</p></div><button class="btn" data-recruit="'+cls+'" '+(ok?"":"disabled")+'>Recruit</button></div></div>'}).join("")+'</div>';
  panel.querySelectorAll("[data-team]").forEach(x=>x.addEventListener("change",()=>{const id=Number(x.dataset.team);if(x.checked){if(selectedTeam.size>=5){x.checked=false;toast("Maximum 5 units");return}selectedTeam.add(id)}else selectedTeam.delete(id);sound("click")}));
  panel.querySelectorAll("[data-recruit]").forEach(b=>b.addEventListener("click",()=>{const r=recruit(state,b.dataset.recruit);if(r.ok){state.tutorial=Math.max(state.tutorial,2);floatText(b.dataset.recruit+" joined","good");cityFx.push({type:"recruit",t:performance.now()});sound("upgrade");renderAll()}else toast(r.reason)}));
}
function renderExpedition(){
  const power=armyPower(state,[...selectedTeam]);
  panel.innerHTML=tutorialBox()+'<div class="row"><h2 class="section-title">Expeditions</h2><span class="pill">Team Power '+power+'</span></div><p style="font-size:11px;color:var(--muted)">Choose 3-5 units. Each expedition advances one month. A pending Season War must be resolved first.</p><div class="card-grid">'+REGIONS.map((r,i)=>{const lock=i>0&&state.buildings.townhall<Math.min(4,i+1),art=["","forest","pass","ruins","frontier"][i];return '<div class="card region-card"><div class="region-art '+art+'" data-region-index="'+i+'"></div><h3>'+r.name+' <span class="pill">Power '+r.power+'</span></h3><p>Loot: '+costText(r.reward)+'<br>Rival encounter '+Math.round(r.rival*100)+'%</p><button class="btn good" data-exp="'+r.id+'" '+(lock||selectedTeam.size<3||state.warReady?"disabled":"")+'>'+(state.warReady?"Resolve Season War":lock?"Upgrade Town Hall":"Explore")+'</button></div>'}).join("")+'</div>';
  panel.querySelectorAll(".region-art").forEach(el=>{const ri=Number(el.dataset.regionIndex||0);el.style.backgroundImage='url("assets/regions.svg")';el.style.backgroundSize='500% 100%';el.style.backgroundPosition=(ri*25)+'% 0';});
  panel.querySelectorAll("[data-exp]").forEach(b=>b.addEventListener("click",()=>startExpedition(b.dataset.exp)));
}
function renderTerritory(){
  const labels={h1:"Dawnkeep",h2:"River Farms",n1:"Old Road",n2:"Sunken Mine",n3:"Crosswind",a1:"Crystal Verge",a2:"Astral Gate",d1:"Cinder March",d2:"Ash Bastion"};
  const cells=Object.entries(state.territory).map(([k,v])=>'<div class="node '+v+'"><strong><i class="banner-mark"></i>'+labels[k]+'</strong><small>'+v.toUpperCase()+'</small></div>').join("");
  panel.innerHTML='<h2 class="section-title">Frontier Territory</h2><div class="map-wrap"><div class="map-grid">'+cells+'</div></div><h2 class="section-title">Rival Factions</h2>'+["arcane","demon"].map(rivalCard).join("");
}
function rivalCard(k){const r=state.rivals[k];return '<div class="card faction-'+k+'"><div class="unit-line"><div class="avatar"></div><div><b>'+r.name+'</b><p>City Lv.'+r.cityLevel+' · Army '+r.armyPower+' · Territory '+r.territory+'</p><span class="pill">'+(r.conquered?"CONQUERED":r.capitalUnlocked?"CAPITAL UNLOCKED":"Capital locked")+'</span></div></div></div>'}
function ensureSelections(){const valid=new Set(state.units.map(u=>u.id));selectedTeam=new Set([...selectedTeam].filter(id=>valid.has(id)));while(selectedTeam.size<Math.min(4,state.units.length))for(const u of state.units){selectedTeam.add(u.id);if(selectedTeam.size>=4)break}}

function startExpedition(id){
  if(state.gameOver)return;if(state.warReady){showSeasonWar();return}
  const region=REGIONS.find(r=>r.id===id),ids=[...selectedTeam],preview=armyPower(state,ids);
  openModal('<div class="hero-title"><small>EXPEDITION</small><h2>'+region.name+'</h2><span class="pill">Team '+preview+' · Recommended '+region.power+'</span></div><div id="battleStage" class="battlefield"></div><div id="battleLog" class="log">Scouts enter the region. Weapons ready.</div><div class="row" style="margin-top:10px"><button id="resolveBattleBtn" class="btn good">Begin Auto Battle</button><button id="cancelBattleBtn" class="btn">Retreat</button></div>');
  drawBattlePreview(ids,null);q("#cancelBattleBtn").addEventListener("click",closeModal);q("#resolveBattleBtn").addEventListener("click",()=>{q("#resolveBattleBtn").disabled=true;const result=expeditionOutcome(state,region,ids);if(!result.ok){toast(result.reason);closeModal();return}animateBattle(ids,result,()=>finishExpedition(result,ids))});
}
function finishExpedition(result){
  if(result.win)state.tutorial=Math.max(state.tutorial,3);const ev=randomEvent(state),loot=costText(result.reward)||"No loot";
  sound(result.win?"victory":"hit");
  modalBody.innerHTML='<div class="result-big"><h2 class="'+(result.win?"victory":"defeat")+'">'+(result.win?"VICTORY":"DEFEAT")+'</h2><p>'+(result.rivalType?"You encountered the "+result.rivalType+" faction.":"You fought local monsters.")+'</p><p>Power '+result.playerPower+' vs '+result.enemyPower+'</p><p>Loot: '+loot+'</p>'+(ev?'<div class="card"><b>'+ev.title+'</b><p>'+ev.text+'</p></div>':'')+(result.seasonTriggered?'<p class="capital-badge">SEASON WAR UNLOCKED</p>':'')+'<button id="returnBtn" class="btn good">Return to Dawnkeep</button></div>';
  q("#returnBtn").addEventListener("click",()=>{closeModal();floatText(result.win?"+ Loot returned":"Survivors returned",result.win?"gold":"good");if(result.seasonTriggered){sound("war");toast("Season War ready — choose a rival before the next expedition.")}renderAll()});
}
function drawBattlePreview(ids,rivalType){
  const stage=q("#battleStage");if(!stage)return;stage.classList.toggle("arcane",rivalType==="arcane");stage.classList.toggle("demon",rivalType==="demon");stage.innerHTML="";
  ids.slice(0,5).forEach((id,i)=>{const u=state.units.find(x=>x.id===id);stage.insertAdjacentHTML("beforeend",fighterHtml(9+i*7,30+(i%2)*38,false,u?.cls||"Warrior",null))});
  for(let i=0;i<4;i++)stage.insertAdjacentHTML("beforeend",fighterHtml(72+i*5,34+(i%2)*42,true,"Warrior",rivalType));
}
function fighterHtml(left,top,enemy,cls,rival){return '<div class="fighter '+cls.toLowerCase()+' '+(enemy?"enemy ":"")+(rival||"")+'" style="left:'+left+'%;top:'+top+'%"><div class="hp"><span style="width:100%"></span></div><div class="head"></div><div class="body"></div><div class="weapon"></div></div>'}
function animateBattle(ids,result,done){
  drawBattlePreview(ids,result.rivalType);const stage=q("#battleStage"),log=q("#battleLog"),fighters=[...stage.querySelectorAll(".fighter")];let tick=0;
  const timer=setInterval(()=>{tick++;fighters.forEach((f,i)=>{const enemy=f.classList.contains("enemy");f.style.left=(enemy?Math.max(52,72+i%4*5-tick*2.8):Math.min(44,9+i*7+tick*2.8))+"%";if((i+tick)%3===0){f.classList.add("hit");setTimeout(()=>f.classList.remove("hit"),120)}const hp=f.querySelector(".hp span");hp.style.width=Math.max(6,100-tick*(result.win&&enemy?19:result.win?8:enemy?7:19))+"%"});spawnProjectile(stage,tick);spawnDamage(stage,tick,result);sound(tick%3===0?"magic":tick%2===0?"arrow":"hit");log.innerHTML+="<br>Exchange "+tick+": "+(tick%2?"front line clashes":"arrows and spellfire cross the field")+".";
    log.scrollTop=log.scrollHeight;if(tick>=5){clearInterval(timer);fighters.forEach(f=>{if((result.win&&f.classList.contains("enemy"))||(!result.win&&!f.classList.contains("enemy")))f.classList.add("down")});setTimeout(done,520)}
  },260);
}
function spawnProjectile(stage,tick){if(tick<2||tick>4)return;const p=document.createElement("div");p.className="projectile sprite-vfx "+(tick===3?"magic":tick===4?"holy":"");p.style.left="34%";p.style.top=(34+tick*8)+"%";stage.appendChild(p);setTimeout(()=>p.remove(),430)}
function spawnDamage(stage,tick,result){const d=document.createElement("div");d.className="damage";d.textContent="-"+Math.round((result.enemyPower/8)*(0.7+tick*.12));d.style.left=(result.win?68:34)+"%";d.style.top=(34+(tick%2)*30)+"%";stage.appendChild(d);setTimeout(()=>d.remove(),700)}

function showSeasonWar(){
  if(!state.warReady)return;const ids=[...selectedTeam];if(ids.length<3){toast("Choose at least 3 units");activeTab="army";renderPanel();return}
  sound("war");openModal('<div class="hero-title"><small>SEASON '+(state.pendingWarSeason||Math.max(1,state.season-1))+' FINALE</small><h2>Season War</h2><span class="capital-badge">THE FRONTIER IS CONTESTED</span></div><p style="text-align:center;color:var(--muted)">Choose one rival. Victory captures territory; a capital victory conquers the faction.</p><div class="card-grid">'+["arcane","demon"].map(k=>{const r=state.rivals[k];if(r.conquered)return '<div class="card"><h3>'+r.name+'</h3><p>Already conquered.</p></div>';return '<div class="card war-choice '+k+'"><h3>'+r.name+'</h3><p>City Lv.'+r.cityLevel+' · Army '+seasonWarPower(state,k,false)+' · Territory '+r.territory+'</p><p>Reward: Gold 190 · Wood 105 · Stone 105 · Crystal 38</p><button class="btn danger" data-war="'+k+'" data-capital="0">Attack Territory</button> '+(r.capitalUnlocked?'<button class="btn warn" data-war="'+k+'" data-capital="1">Assault Capital</button>':'<span class="pill">Capital locked</span>')+'</div>'}).join("")+'</div>');
  modalBody.querySelectorAll("[data-war]").forEach(b=>b.addEventListener("click",()=>runSeasonWar(b.dataset.war,b.dataset.capital==="1",ids)));
}
function runSeasonWar(key,capital,ids){
  const r=resolveSeasonWar(state,key,ids,Math.random,capital);if(!r.ok){toast(r.reason);return}sound(r.win?"victory":"hit");
  const title=r.win?(capital?"CAPITAL CONQUERED":"WAR VICTORY"):"WAR DEFEAT";
  modalBody.innerHTML='<div class="result-big '+(capital?"campaign-end":"")+'"><small class="capital-badge">'+(capital?"CAPITAL ASSAULT":"SEASON WAR")+'</small><h2 class="'+(r.win?"victory":"defeat")+'">'+title+'</h2><p>Army '+r.playerPower+' vs '+r.enemyPower+'</p><p>'+state.lastMessage+'</p><button id="warReturn" class="btn good">Return to Dawnkeep</button></div>';
  q("#warReturn").addEventListener("click",()=>{closeModal();floatText(r.win?(capital?"Capital Fallen":"+ Territory"):"Army regrouped",r.win?"magic":"good");renderAll()});
}
function showGuide(){openModal('<div class="hero-title"><small>COMMANDER GUIDE</small><h2>How to Win</h2></div><div class="stack"><div class="card"><b>1. Build</b><p>Upgrade Dawnkeep. Town Hall opens harder regions; Houses increase population.</p></div><div class="card"><b>2. Explore</b><p>Send 3-5 units. Battles are automatic and each expedition advances one month.</p></div><div class="card"><b>3. Season War</b><p>Every three months you must resolve a war before exploring again.</p></div><div class="card"><b>4. Capital</b><p>Win wars, reduce territory, reach Town Hall Lv.3 and Army Power 330 to unlock a capital assault.</p></div><div class="card"><b>5. Victory</b><p>Conquer both rival capitals before the campaign deadline.</p></div></div>')}

function checkEnd(){
  if(!state.gameOver)return;
  if(state.victory){const best=strongestUnit(state),bestPower=best?unitStats(state,best).power:0;
    openModal('<div class="result-big campaign-end"><small class="capital-badge">BOTH CAPITALS HAVE FALLEN</small><h2 class="victory">CAMPAIGN VICTORY</h2><p>Dawnkeep has united the frontier.</p><div class="card"><p>Seasons '+state.season+' · Battles Won '+state.stats.wins+' / '+state.stats.battles+' · Territories '+state.stats.territories+'</p><p>Final City Lv.'+state.buildings.townhall+' · Army Power '+armyPower(state)+'</p><p>Strongest Unit: '+(best?best.cls+' #'+best.id+' · Power '+bestPower:'—')+'</p></div><button class="btn good" id="sandboxBtn">Continue Sandbox</button> <button class="btn" id="victoryNew">New Game</button></div>');
    q("#sandboxBtn").addEventListener("click",()=>{state.gameOver=false;state.sandbox=true;closeModal();toast("Sandbox mode — the frontier remains open.");persist()});
    q("#victoryNew").addEventListener("click",()=>{resetGame();closeModal()});
  }else openModal('<div class="result-big"><h2 class="defeat">CAMPAIGN DEFEAT</h2><p>The frontier closes before both rival capitals fall.</p><button id="retryBtn" class="btn good">Start Again</button></div>'),q("#retryBtn")?.addEventListener("click",()=>{resetGame();closeModal()});
}

function renderCity(){
  const dpr=Math.min(2,window.devicePixelRatio||1),rect=canvas.getBoundingClientRect(),w=Math.max(360,rect.width),h=Math.max(315,rect.height);
  if(canvas.width!==Math.floor(w*dpr)||canvas.height!==Math.floor(h*dpr)){canvas.width=Math.floor(w*dpr);canvas.height=Math.floor(h*dpr);ctx.setTransform(dpr,0,0,dpr,0,0)}
  ctx.clearRect(0,0,w,h);
  const horizon=h*.27,sky=ctx.createLinearGradient(0,0,0,horizon);
  sky.addColorStop(0,"#78b5da");sky.addColorStop(.55,"#b8d7d7");sky.addColorStop(1,"#e8e3c5");
  ctx.fillStyle=sky;ctx.fillRect(0,0,w,horizon);
  drawClouds(w,horizon);
  drawMountains(w,horizon);
  const ground=ctx.createLinearGradient(0,horizon,0,h);ground.addColorStop(0,"#789b67");ground.addColorStop(1,"#5f8057");ctx.fillStyle=ground;ctx.fillRect(0,horizon,w,h-horizon);

  const tileW=Math.min(72,w/10.8),tileH=tileW*.5,ox=w*.5,oy=horizon+18;
  drawIsoGround(ox,oy,tileW,tileH);
  drawRoad(ox,oy,tileW,tileH);
  drawDecorations(ox,oy,tileW,tileH);

  const placements=[[4,1],[2,2],[6,2],[1,4],[7,4],[3,5],[5,5],[8,1],[0,2],[8,6]];
  const visible=Object.entries(state.buildings).filter(([,lvl])=>lvl>0);
  visible
    .map(([k,lvl],i)=>({k,lvl,i,p:iso(...placements[i%placements.length],ox,oy,tileW,tileH)}))
    .sort((a,b)=>a.p.y-b.p.y)
    .forEach(({k,lvl,p})=>drawBuilding(p.x,p.y,k,lvl,tileW));

  drawCityLife(ox,oy,tileW,tileH);
  drawForeground(ox,oy,tileW,tileH);
  drawCityFx(ox,oy,tileW,tileH);
}
function iso(gx,gy,ox,oy,tw,th){return{x:ox+(gx-gy)*tw/2,y:oy+(gx+gy)*th/2}}
function diamond(x,y,w,h,fill,stroke){ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+w/2,y+h/2);ctx.lineTo(x,y+h);ctx.lineTo(x-w/2,y+h/2);ctx.closePath();ctx.fillStyle=fill;ctx.fill();ctx.strokeStyle=stroke;ctx.lineWidth=.65;ctx.stroke()}
function drawClouds(w,y){
  ctx.save();ctx.globalAlpha=.22;ctx.fillStyle="#fff";
  for(let i=0;i<5;i++){const x=((animT*.006+i*190)%(w+180))-90,cy=22+(i%3)*18;ctx.beginPath();ctx.ellipse(x,cy,36,12,0,0,Math.PI*2);ctx.ellipse(x+28,cy+3,26,10,0,0,Math.PI*2);ctx.ellipse(x-25,cy+4,22,8,0,0,Math.PI*2);ctx.fill()}
  ctx.restore();
}
function drawMountains(w,y){
  const layers=[["#79909a",.95,0],["#667c79",.65,18]];
  for(const [color,alpha,off] of layers){ctx.globalAlpha=alpha;ctx.fillStyle=color;for(let i=0;i<9;i++){const x=i*w/8-55+off,hh=28+(i%4)*13;ctx.beginPath();ctx.moveTo(x-95,y);ctx.lineTo(x,y-hh);ctx.lineTo(x+102,y);ctx.closePath();ctx.fill()}}
  ctx.globalAlpha=1;ctx.fillStyle="rgba(255,244,204,.65)";ctx.beginPath();ctx.arc(w*.8,y*.23,22,0,Math.PI*2);ctx.fill();
}
function drawIsoGround(ox,oy,tw,th){
  for(let gy=0;gy<8;gy++)for(let gx=0;gx<10;gx++){
    const p=iso(gx,gy,ox,oy,tw,th),v=(gx*7+gy*11)%5,fill=["#7ea66d","#82aa71","#78a168","#86ad74","#7ba46a"][v];
    diamond(p.x,p.y,tw,th,fill,"rgba(61,95,55,.45)");
    if((gx+gy)%6===0){ctx.fillStyle="rgba(226,232,173,.25)";for(let s=0;s<4;s++)ctx.fillRect(p.x-14+s*6,p.y+th*.56+(s%2)*2,2,4)}
  }
}
function drawRoad(ox,oy,tw,th){
  ctx.save();ctx.lineCap="round";
  ctx.strokeStyle="#886f52";ctx.lineWidth=Math.max(12,tw*.2);
  const a=iso(0,5,ox,oy,tw,th),b=iso(9,5,ox,oy,tw,th),c=iso(5,0,ox,oy,tw,th),d=iso(5,7,ox,oy,tw,th);
  ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.beginPath();ctx.moveTo(c.x,c.y);ctx.lineTo(d.x,d.y);ctx.stroke();
  ctx.strokeStyle="#b8a07a";ctx.lineWidth=Math.max(8,tw*.14);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.beginPath();ctx.moveTo(c.x,c.y);ctx.lineTo(d.x,d.y);ctx.stroke();
  ctx.restore();
}
function drawDecorations(ox,oy,tw,th){
  const items=[[1,1,"crate"],[8,2,"barrel"],[2,6,"fire"],[7,6,"fence"],[0,5,"fence"],[9,4,"rock"],[6,6,"lamp"],[4,6,"sign"],[1,6,"flowers"],[8,5,"flowers"]];
  for(const [gx,gy,t] of items){const p=iso(gx,gy,ox,oy,tw,th);ctx.save();ctx.translate(p.x,p.y);
    if(t==="crate"){ctx.fillStyle="#86623f";ctx.fillRect(-8,-11,16,13);ctx.strokeStyle="#4f3824";ctx.strokeRect(-8,-11,16,13);ctx.beginPath();ctx.moveTo(-8,-11);ctx.lineTo(8,2);ctx.moveTo(8,-11);ctx.lineTo(-8,2);ctx.stroke()}
    if(t==="barrel"){ctx.fillStyle="#7a5738";ctx.beginPath();ctx.ellipse(0,-4,8,11,0,0,Math.PI*2);ctx.fill();ctx.strokeStyle="#463427";ctx.beginPath();ctx.moveTo(-7,-8);ctx.lineTo(7,-8);ctx.moveTo(-8,-1);ctx.lineTo(8,-1);ctx.stroke()}
    if(t==="fire"){ctx.fillStyle="#5a4331";ctx.fillRect(-10,0,20,3);ctx.fillStyle="#f8c251";ctx.beginPath();ctx.moveTo(-7,0);ctx.quadraticCurveTo(-2,-13,0,-22-Math.sin(animT*.006)*3);ctx.quadraticCurveTo(4,-10,7,0);ctx.fill();ctx.fillStyle="#eb6d3a";ctx.beginPath();ctx.moveTo(-3,0);ctx.lineTo(1,-13);ctx.lineTo(4,0);ctx.fill()}
    if(t==="fence"){ctx.strokeStyle="#795a39";ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(-15,-2);ctx.lineTo(15,-8);ctx.stroke();for(const x of [-11,0,11]){ctx.beginPath();ctx.moveTo(x,-13);ctx.lineTo(x,5);ctx.stroke()}}
    if(t==="rock"){ctx.fillStyle="#6a746f";ctx.beginPath();ctx.moveTo(-10,0);ctx.lineTo(-7,-9);ctx.lineTo(2,-13);ctx.lineTo(11,-5);ctx.lineTo(8,1);ctx.closePath();ctx.fill();ctx.fillStyle="rgba(255,255,255,.1)";ctx.fillRect(-3,-8,7,2)}
    if(t==="lamp"){ctx.strokeStyle="#4a3a2a";ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(0,4);ctx.lineTo(0,-20);ctx.stroke();ctx.fillStyle="#ffd36e";ctx.beginPath();ctx.arc(0,-20,4,0,Math.PI*2);ctx.fill();ctx.shadowColor="#ffd36e";ctx.shadowBlur=12;ctx.fill();ctx.shadowBlur=0}
    if(t==="sign"){ctx.strokeStyle="#563f2c";ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(0,4);ctx.lineTo(0,-18);ctx.stroke();ctx.fillStyle="#8c6945";ctx.fillRect(-11,-19,22,8)}
    if(t==="flowers"){for(let i=0;i<5;i++){ctx.fillStyle=i%2?"#f2d67a":"#d98d9d";ctx.beginPath();ctx.arc(-8+i*4,-2-(i%2)*3,2,0,Math.PI*2);ctx.fill()}}
    ctx.restore();
  }
}
function buildingShadow(x,y,w){ctx.fillStyle="rgba(28,38,30,.22)";ctx.beginPath();ctx.ellipse(x+6,y+9,w*.62,9,0,0,Math.PI*2);ctx.fill()}
function isoBox(x,y,w,h,d,front,side,top){
  ctx.fillStyle=front;ctx.beginPath();ctx.moveTo(x-w/2,y-h);ctx.lineTo(x+w/2,y-h);ctx.lineTo(x+w/2,y);ctx.lineTo(x-w/2,y);ctx.closePath();ctx.fill();
  ctx.fillStyle=side;ctx.beginPath();ctx.moveTo(x+w/2,y-h);ctx.lineTo(x+w/2+d,y-h-d*.45);ctx.lineTo(x+w/2+d,y-d*.45);ctx.lineTo(x+w/2,y);ctx.closePath();ctx.fill();
  ctx.fillStyle=top;ctx.beginPath();ctx.moveTo(x-w/2,y-h);ctx.lineTo(x-w/2+d,y-h-d*.45);ctx.lineTo(x+w/2+d,y-h-d*.45);ctx.lineTo(x+w/2,y-h);ctx.closePath();ctx.fill();
}
function roof3d(x,y,w,h,color){
  ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(x-w*.58,y);ctx.lineTo(x,y-h);ctx.lineTo(x+w*.58,y);ctx.lineTo(x,y+h*.18);ctx.closePath();ctx.fill();
  ctx.fillStyle="rgba(255,255,255,.12)";ctx.beginPath();ctx.moveTo(x-w*.58,y);ctx.lineTo(x,y-h);ctx.lineTo(x,y+h*.18);ctx.closePath();ctx.fill();
}
function tinyWindow(x,y,glow="#ffd271"){ctx.fillStyle="#5d4532";ctx.fillRect(x-4,y-5,8,9);ctx.fillStyle=glow;ctx.fillRect(x-2,y-3,4,5)}
function banner(x,y,color){ctx.fillStyle="#4d3827";ctx.fillRect(x-1,y-4,2,22);ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(x,y-4);ctx.lineTo(x+13,y+1);ctx.lineTo(x,y+8);ctx.closePath();ctx.fill()}
function chimney(x,y){ctx.fillStyle="#4c4b49";ctx.fillRect(x-4,y-14,8,14);ctx.fillStyle="rgba(210,219,215,.28)";ctx.beginPath();ctx.arc(x+3,y-18-Math.sin(animT*.002)*2,5,0,Math.PI*2);ctx.fill()}
function drawBuilding(x,y,k,lvl,scale){
  if(spriteSheets.buildings.complete && spriteSheets.buildings.naturalWidth){
    const i=buildingSpriteIndex[k];
    if(i!==undefined){
      const sx=(i%5)*128, sy=Math.floor(i/5)*128;
      const size=scale*(1.52+Math.min(4,lvl)*.055);
      ctx.drawImage(spriteSheets.buildings,sx,sy,128,128,x-size/2,y-size*.88,size,size);
      if(lvl>=2){ctx.save();ctx.globalAlpha=.22+.06*lvl;ctx.strokeStyle="#f2d88b";ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(x,y+5,size*.34,7,0,0,Math.PI*2);ctx.stroke();ctx.restore()}
      return;
    }
  }
  const s=scale*(.58+lvl*.028),tier=Math.min(4,lvl),upgrade=tier>=3;
  buildingShadow(x,y,s);
  if(k==="townhall"){
    isoBox(x,y,s*1.05,38+tier*3,10,"#d8c8a4","#aa997e","#eadfc4");roof3d(x+3,y-40-tier*3,s*.68,24+tier*2,"#4c6f9f");
    isoBox(x-s*.35,y-16,s*.23,34+tier*2,5,"#b9b2a2","#8f8a7f","#d5d0c4");isoBox(x+s*.36,y-16,s*.23,34+tier*2,5,"#b9b2a2","#8f8a7f","#d5d0c4");
    tinyWindow(x-16,y-23);tinyWindow(x+13,y-23);ctx.fillStyle="#4a3529";ctx.fillRect(x-7,y-16,14,16);banner(x,y-72-tier*5,"#496f9f");
  } else if(k==="house"){
    isoBox(x,y,s*.88,27,8,"#d6bd91","#aa8d68","#eee0bc");roof3d(x+2,y-28,s*.56,19,"#985d47");tinyWindow(x-14,y-15);tinyWindow(x+9,y-15);
    if(lvl>=2){ctx.fillStyle="#7c5a3c";ctx.fillRect(x+s*.35,y-15,11,15)}if(upgrade)chimney(x+s*.28,y-42);
  } else if(k==="barracks"){
    isoBox(x,y,s,28+tier,8,"#c9b18a","#9e8766","#dfccb0");roof3d(x+2,y-30,s*.62,18,"#7b3f44");
    ctx.strokeStyle="#d5dce5";ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(x+s*.36,y-5);ctx.lineTo(x+s*.49,y-31);ctx.stroke();ctx.fillStyle="#5c3b2d";ctx.fillRect(x-7,y-15,14,15);banner(x-s*.34,y-47,"#99444a");
  } else if(k==="archery"){
    isoBox(x,y,s*.96,25,8,"#c9b893","#9c8b68","#e4d4b4");roof3d(x+1,y-26,s*.58,16,"#56774f");ctx.strokeStyle="#d8c18d";ctx.lineWidth=3;ctx.beginPath();ctx.arc(x+s*.39,y-15,11,-1.2,1.2);ctx.stroke();
    for(let i=0;i<3;i++){ctx.strokeStyle="#c7d0d7";ctx.beginPath();ctx.moveTo(x+s*.3+i*3,y-2);ctx.lineTo(x+s*.34+i*3,y-18);ctx.stroke()}
  } else if(k==="chapel"){
    ctx.fillStyle="#d9d2c2";ctx.beginPath();ctx.moveTo(x-s*.42,y);ctx.lineTo(x-s*.31,y-34);ctx.lineTo(x,y-55-tier*2);ctx.lineTo(x+s*.31,y-34);ctx.lineTo(x+s*.42,y);ctx.closePath();ctx.fill();
    ctx.fillStyle="#7461aa";ctx.beginPath();ctx.arc(x,y-31,7,0,Math.PI*2);ctx.fill();ctx.strokeStyle="#9c8df1";ctx.lineWidth=2;ctx.beginPath();ctx.arc(x,y-31,13+Math.sin(animT*.003)*1.5,0,Math.PI*2);ctx.stroke();ctx.fillStyle="#9c8df1";ctx.fillRect(x-2,y-61-tier*2,4,10);
  } else if(k==="blacksmith"){
    isoBox(x,y,s*.94,24,8,"#9b9992","#74736e","#b9b7b0");roof3d(x+1,y-25,s*.55,14,"#4d5056");chimney(x+s*.25,y-39);
    ctx.fillStyle="#e67e43";ctx.beginPath();ctx.arc(x+s*.32,y-5,6,0,Math.PI*2);ctx.fill();ctx.fillStyle="#5b4632";ctx.fillRect(x-8,y-13,16,13);
  } else if(k==="warehouse"){
    isoBox(x,y,s*1.12,24,9,"#b99971","#8c704f","#d7bd98");roof3d(x+1,y-25,s*.66,14,"#6c533e");
    for(const dx of [-18,0,18]){ctx.fillStyle="#765938";ctx.fillRect(x+dx-6,y-12,12,12);ctx.strokeStyle="#4f3926";ctx.strokeRect(x+dx-6,y-12,12,12)}
  } else if(k==="training"){
    ctx.strokeStyle="#7b593b";ctx.lineWidth=4;ctx.strokeRect(x-s*.48,y-18,s*.96,18);ctx.fillStyle="#9a7955";ctx.beginPath();ctx.arc(x,y-20,8,0,Math.PI*2);ctx.fill();ctx.fillRect(x-2,y-19,4,20);
    ctx.strokeStyle="#c5ccd3";ctx.beginPath();ctx.moveTo(x+s*.28,y-3);ctx.lineTo(x+s*.4,y-18);ctx.moveTo(x+s*.4,y-3);ctx.lineTo(x+s*.28,y-18);ctx.stroke();
  } else if(k==="shrine"){
    ctx.fillStyle="#dad4c5";ctx.beginPath();ctx.moveTo(x-s*.4,y);ctx.lineTo(x-s*.3,y-28);ctx.lineTo(x,y-42);ctx.lineTo(x+s*.3,y-28);ctx.lineTo(x+s*.4,y);ctx.closePath();ctx.fill();ctx.fillStyle="#6e9b9d";ctx.beginPath();ctx.arc(x,y-19,9,0,Math.PI*2);ctx.fill();
    ctx.save();ctx.globalAlpha=.35+.08*Math.sin(animT*.004);ctx.strokeStyle="#8de6df";ctx.lineWidth=3;ctx.beginPath();ctx.arc(x,y-20,15,0,Math.PI*2);ctx.stroke();ctx.restore();
  } else if(k==="watchtower"){
    isoBox(x,y,s*.45,48,7,"#aaa69d","#817f79","#c7c3ba");roof3d(x+1,y-49,s*.34,16,"#56616d");ctx.fillStyle="#44382f";ctx.fillRect(x-4,y-17,8,17);banner(x+s*.2,y-64,"#4f6f9c");
    if(upgrade){ctx.strokeStyle="#bfc8d5";ctx.beginPath();ctx.moveTo(x-s*.28,y-45);ctx.lineTo(x-s*.4,y-59);ctx.stroke()}
  }
  if(lvl>=4){ctx.save();ctx.globalAlpha=.55;ctx.strokeStyle="#f2d88b";ctx.lineWidth=1.5;ctx.beginPath();ctx.ellipse(x,y+4,s*.55,7,0,0,Math.PI*2);ctx.stroke();ctx.restore()}
}
function drawCityLife(ox,oy,tw,th){
  const list=state.units.slice(0,Math.min(12,state.units.length)),civilians=Math.max(4,Math.min(10,(state.buildings.house||1)*2+2));
  const chars=[];
  for(let i=0;i<list.length+civilians;i++){const u=list[i]||{cls:"Civilian"},a=animT*.00013+i*1.62,gx=4.5+Math.cos(a+i*.21)*2.7,gy=4+Math.sin(a*1.27+i*.37)*2.0,p=iso(gx,gy,ox,oy,tw,th);chars.push({p,u,i})}
  chars.sort((a,b)=>a.p.y-b.p.y).forEach(({p,u,i})=>drawChibi(p.x,p.y-3,u.cls,i));
}
function drawChibi(x,y,cls,i){
  const si=charSpriteIndex[cls];
  if(si!==undefined && spriteSheets.characters.complete && spriteSheets.characters.naturalWidth){
    const bob=Math.sin(animT*.006+i)*1.4,size=54;
    ctx.save();ctx.translate(x,y+bob);ctx.drawImage(spriteSheets.characters,si*128,0,128,128,-size/2,-size*.9,size,size);ctx.restore();
    return;
  }
  const palette={Warrior:"#557cb6",Archer:"#64845e",Mage:"#7563b2",Cleric:"#d0b978",Knight:"#6f7e98",Rogue:"#67586f",Civilian:i%2?"#8b6e4d":"#6f7f66"};
  const body=palette[cls]||"#557cb6",bob=Math.sin(animT*.006+i)*1.2,step=Math.sin(animT*.01+i)*2;
  ctx.save();ctx.translate(x,y+bob);
  ctx.fillStyle="rgba(20,28,22,.22)";ctx.beginPath();ctx.ellipse(2,10,10,3.6,0,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle="#533e31";ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-3,6);ctx.lineTo(-4+step,11);ctx.moveTo(3,6);ctx.lineTo(4-step,11);ctx.stroke();
  ctx.fillStyle=body;ctx.beginPath();ctx.roundRect(-8,-8,16,17,5);ctx.fill();
  ctx.fillStyle="#e4bf9e";ctx.beginPath();ctx.arc(0,-14,7.3,0,Math.PI*2);ctx.fill();
  ctx.fillStyle=cls==="Mage"?"#4d3c6a":cls==="Cleric"?"#d8c7a5":cls==="Rogue"?"#352c39":"#49372d";ctx.beginPath();ctx.arc(0,-17,7.3,Math.PI,Math.PI*2);ctx.fill();
  ctx.fillStyle="#2c2a2d";ctx.fillRect(-3,-14,1.5,1.5);ctx.fillRect(2,-14,1.5,1.5);
  if(cls==="Warrior"||cls==="Knight"){ctx.strokeStyle="#d7dee8";ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(7,-2);ctx.lineTo(14,-14);ctx.stroke();if(cls==="Knight"){ctx.strokeStyle="#91a3b8";ctx.beginPath();ctx.arc(-8,-1,5.5,0,Math.PI*2);ctx.stroke();ctx.fillStyle="#919dac";ctx.fillRect(-6,-21,12,4)}}
  if(cls==="Archer"){ctx.strokeStyle="#d2b980";ctx.lineWidth=2;ctx.beginPath();ctx.arc(9,-5,7,-1.15,1.15);ctx.stroke();ctx.beginPath();ctx.moveTo(10,-12);ctx.lineTo(10,2);ctx.stroke()}
  if(cls==="Mage"||cls==="Cleric"){ctx.strokeStyle="#8b6945";ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(8,4);ctx.lineTo(10,-18);ctx.stroke();ctx.fillStyle=cls==="Mage"?"#a998f0":"#ffe6a8";ctx.shadowColor=ctx.fillStyle;ctx.shadowBlur=8;ctx.beginPath();ctx.arc(10,-19,3.5,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0}
  if(cls==="Rogue"){ctx.strokeStyle="#d7dee8";ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(7,-1);ctx.lineTo(13,-8);ctx.moveTo(-7,-1);ctx.lineTo(-13,-8);ctx.stroke()}
  if(cls==="Civilian"&&i%3===0){ctx.fillStyle="#8a6542";ctx.fillRect(7,-1,5,6);ctx.fillStyle="#b99058";ctx.fillRect(8,-3,3,3)}
  ctx.restore();
}
function drawForeground(ox,oy,tw,th){
  const trees=[[0,7],[1,7],[8,7],[9,7],[9,6],[-1,6]];
  for(let i=0;i<trees.length;i++){const [gx,gy]=trees[i],p=iso(gx,gy,ox,oy,tw,th);drawTree(p.x,p.y,i)}
}
function drawTree(x,y,i){
  ctx.fillStyle="#5a4635";ctx.fillRect(x-2,y-25,4,25);
  const greens=i%2?["#315e3f","#42724a","#5b8757"]:["#3b6845","#4d7b4f","#66905e"];
  ctx.fillStyle=greens[0];ctx.beginPath();ctx.arc(x,y-31,12,0,Math.PI*2);ctx.fill();
  ctx.fillStyle=greens[1];ctx.beginPath();ctx.arc(x-8,y-26,8,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(x+8,y-27,9,0,Math.PI*2);ctx.fill();
  ctx.fillStyle=greens[2];ctx.beginPath();ctx.arc(x,y-37,8,0,Math.PI*2);ctx.fill();
}
function drawCityFx(ox,oy,tw,th){
  const now=performance.now();for(let i=cityFx.length-1;i>=0;i--){const fx=cityFx[i],age=(now-fx.t)/1000;if(age>1.15){cityFx.splice(i,1);continue}const p=iso(4.8,3.8,ox,oy,tw,th);ctx.globalAlpha=1-age/1.15;ctx.fillStyle=fx.type==="recruit"?"#9fdbb4":"#e7d19a";for(let j=0;j<10;j++){const a=j*Math.PI/5+age*2,r=14+age*28;ctx.beginPath();ctx.arc(p.x+Math.cos(a)*r,p.y-18+Math.sin(a)*r*.5,2.5,0,Math.PI*2);ctx.fill()}ctx.globalAlpha=1}
}
function loop(t){const dt=t-lastFrame;lastFrame=t;animT=t;if(dt<80)renderCity();requestAnimationFrame(loop)}
window.addEventListener("resize",renderCity);renderAll();renderCity();if(!qaMode)requestAnimationFrame(loop);
