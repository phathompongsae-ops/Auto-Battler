import {BUILDINGS,UNIT_CLASSES,REGIONS,createInitialState,normalizeState,buildingCost,canAfford,resourceCap,armyPower,unitStats,strongestUnit,recruit,upgradeBuilding,expeditionOutcome,resolveSeasonWar,randomEvent,seasonWarPower,updateCapitalLocks} from "./src/fantasy-core.js";

const SAVE_KEY="realmfront-save-v2";
let state=normalizeState(loadRaw());
let activeTab="build",selectedTeam=new Set(state.units.slice(0,4).map(u=>u.id)),animT=0,lastFrame=0,soundOn=true;
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
  panel.innerHTML=tutorialBox()+'<div class="row"><h2 class="section-title">Expeditions</h2><span class="pill">Team Power '+power+'</span></div><p style="font-size:11px;color:var(--muted)">Choose 3-5 units. Each expedition advances one month. A pending Season War must be resolved first.</p><div class="card-grid">'+REGIONS.map((r,i)=>{const lock=i>0&&state.buildings.townhall<Math.min(4,i+1),art=["","forest","pass","ruins","frontier"][i];return '<div class="card region-card"><div class="region-art '+art+'"></div><h3>'+r.name+' <span class="pill">Power '+r.power+'</span></h3><p>Loot: '+costText(r.reward)+'<br>Rival encounter '+Math.round(r.rival*100)+'%</p><button class="btn good" data-exp="'+r.id+'" '+(lock||selectedTeam.size<3||state.warReady?"disabled":"")+'>'+(state.warReady?"Resolve Season War":lock?"Upgrade Town Hall":"Explore")+'</button></div>'}).join("")+'</div>';
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
function spawnProjectile(stage,tick){if(tick<2||tick>4)return;const p=document.createElement("div");p.className="projectile "+(tick===3?"magic":tick===4?"holy":"");p.style.left="34%";p.style.top=(34+tick*8)+"%";stage.appendChild(p);setTimeout(()=>p.remove(),430)}
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
  ctx.clearRect(0,0,w,h);const horizon=h*.29,sky=ctx.createLinearGradient(0,0,0,horizon);sky.addColorStop(0,"#7fb9d8");sky.addColorStop(1,"#d9e6c9");ctx.fillStyle=sky;ctx.fillRect(0,0,w,horizon);ctx.fillStyle="#668b60";ctx.fillRect(0,horizon,w,h-horizon);
  drawMountains(w,horizon);const tileW=Math.min(68,w/11.4),tileH=tileW*.52,ox=w*.5,oy=horizon+24;
  for(let gy=0;gy<8;gy++)for(let gx=0;gx<10;gx++){const p=iso(gx,gy,ox,oy,tileW,tileH);diamond(p.x,p.y,tileW,tileH,(gx+gy)%2?"#779d68":"#83aa72","#668c59")}
  drawRoad(ox,oy,tileW,tileH);drawDecorations(ox,oy,tileW,tileH);
  const placements=[[4,1],[2,2],[6,2],[1,4],[7,4],[3,5],[5,5],[8,1],[0,2],[8,6]];
  Object.entries(state.buildings).filter(([,lvl])=>lvl>0).forEach(([k,lvl],i)=>{const [gx,gy]=placements[i%placements.length],p=iso(gx,gy,ox,oy,tileW,tileH);drawBuilding(p.x,p.y,k,lvl,tileW)});
  drawCityLife(ox,oy,tileW,tileH);drawTrees(ox,oy,tileW,tileH);drawCityFx(ox,oy,tileW,tileH);
}
function iso(gx,gy,ox,oy,tw,th){return{x:ox+(gx-gy)*tw/2,y:oy+(gx+gy)*th/2}}
function diamond(x,y,w,h,fill,stroke){ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+w/2,y+h/2);ctx.lineTo(x,y+h);ctx.lineTo(x-w/2,y+h/2);ctx.closePath();ctx.fillStyle=fill;ctx.fill();ctx.strokeStyle=stroke;ctx.lineWidth=.7;ctx.stroke()}
function drawMountains(w,y){ctx.fillStyle="#718791";for(let i=0;i<8;i++){const x=i*w/7-35,hh=30+(i%3)*14;ctx.beginPath();ctx.moveTo(x-80,y);ctx.lineTo(x,y-hh);ctx.lineTo(x+88,y);ctx.closePath();ctx.fill()}ctx.fillStyle="rgba(255,245,207,.55)";ctx.beginPath();ctx.arc(w*.79,y*.25,24,0,Math.PI*2);ctx.fill()}
function drawRoad(ox,oy,tw,th){ctx.strokeStyle="#a68f68";ctx.lineWidth=Math.max(7,tw*.15);ctx.lineCap="round";const a=iso(0,5,ox,oy,tw,th),b=iso(9,5,ox,oy,tw,th),c=iso(5,0,ox,oy,tw,th),d=iso(5,7,ox,oy,tw,th);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.beginPath();ctx.moveTo(c.x,c.y);ctx.lineTo(d.x,d.y);ctx.stroke()}
function drawDecorations(ox,oy,tw,th){
  for(const [gx,gy,t] of [[1,1,"crate"],[8,2,"barrel"],[2,6,"fire"],[7,6,"fence"],[0,5,"fence"],[9,4,"rock"]]){const p=iso(gx,gy,ox,oy,tw,th);ctx.save();ctx.translate(p.x,p.y);if(t==="crate"){ctx.fillStyle="#856540";ctx.fillRect(-7,-10,14,12);ctx.strokeStyle="#4f3b27";ctx.strokeRect(-7,-10,14,12)}if(t==="barrel"){ctx.fillStyle="#77583b";ctx.beginPath();ctx.ellipse(0,-4,7,10,0,0,Math.PI*2);ctx.fill()}if(t==="fire"){ctx.fillStyle="#5a4331";ctx.fillRect(-9,0,18,3);ctx.fillStyle="#f4a64b";ctx.beginPath();ctx.moveTo(-5,0);ctx.lineTo(0,-18-Math.sin(animT*.006)*3);ctx.lineTo(6,0);ctx.fill()}if(t==="fence"){ctx.strokeStyle="#765c3e";ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(-14,-2);ctx.lineTo(14,-7);ctx.stroke();for(const x of [-10,0,10]){ctx.beginPath();ctx.moveTo(x,-12);ctx.lineTo(x,5);ctx.stroke()}}if(t==="rock"){ctx.fillStyle="#6e756e";ctx.beginPath();ctx.ellipse(0,-2,10,7,-.2,0,Math.PI*2);ctx.fill()}ctx.restore()}
}
function drawBuilding(x,y,k,lvl,scale){
  ctx.fillStyle="rgba(0,0,0,.2)";ctx.beginPath();ctx.ellipse(x,y+12,scale*.38,8,0,0,Math.PI*2);ctx.fill();
  const s=scale*(.55+lvl*.025),wall="#d7c8a6",wood="#795842",blue="#4b6e9e";
  if(k==="townhall"){ctx.fillStyle=wall;ctx.fillRect(x-s*.52,y-36-lvl*3,s*1.04,36+lvl*3);ctx.fillStyle="#5a7398";roof(x,y-38-lvl*3,s*.66,21+lvl*2);tower(x-s*.32,y-38-lvl*3,lvl);tower(x+s*.32,y-38-lvl*3,lvl);banner(x,y-66-lvl*4,blue)}
  else if(k==="house"){ctx.fillStyle="#d5bd92";ctx.fillRect(x-s*.45,y-28,s*.9,28);ctx.fillStyle="#915c45";roof(x,y-29,s*.56,18);window(x-12,y-18);window(x+8,y-18)}
  else if(k==="barracks"){ctx.fillStyle="#c8b18a";ctx.fillRect(x-s*.52,y-27,s*1.04,27);ctx.fillStyle="#713d3f";roof(x,y-28,s*.58,17);banner(x-s*.35,y-43,"#8e3f43");ctx.strokeStyle="#c7d0dc";ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(x+s*.34,y-8);ctx.lineTo(x+s*.47,y-34);ctx.stroke()}
  else if(k==="archery"){ctx.fillStyle="#c9ba94";ctx.fillRect(x-s*.48,y-25,s*.96,25);ctx.fillStyle="#55734f";roof(x,y-26,s*.55,15);ctx.strokeStyle="#d8c18d";ctx.lineWidth=3;ctx.beginPath();ctx.arc(x+s*.38,y-15,10,-1.2,1.2);ctx.stroke()}
  else if(k==="chapel"){ctx.fillStyle="#d7d0c0";ctx.beginPath();ctx.moveTo(x-s*.42,y);ctx.lineTo(x-s*.32,y-34);ctx.lineTo(x,y-51-lvl*2);ctx.lineTo(x+s*.32,y-34);ctx.lineTo(x+s*.42,y);ctx.closePath();ctx.fill();ctx.fillStyle="#6f60a5";ctx.beginPath();ctx.arc(x,y-30,7,0,Math.PI*2);ctx.fill();ctx.shadowColor="#9b8cf0";ctx.shadowBlur=12;ctx.fillRect(x-2,y-54,4,10);ctx.shadowBlur=0}
  else if(k==="blacksmith"){ctx.fillStyle="#999991";ctx.fillRect(x-s*.48,y-24,s*.96,24);ctx.fillStyle="#4d5056";roof(x,y-25,s*.54,13);ctx.fillStyle="#3c3a38";ctx.fillRect(x+s*.2,y-44,8,22);ctx.fillStyle="#e87842";ctx.beginPath();ctx.arc(x+s*.34,y-5,5,0,Math.PI*2);ctx.fill()}
  else if(k==="warehouse"){ctx.fillStyle="#b99a72";ctx.fillRect(x-s*.58,y-23,s*1.16,23);ctx.fillStyle="#6d533d";roof(x,y-24,s*.63,14);for(const dx of [-15,0,15]){ctx.fillStyle="#765938";ctx.fillRect(x+dx-5,y-11,10,11)}}
  else if(k==="training"){ctx.strokeStyle="#7d5b3e";ctx.lineWidth=4;ctx.strokeRect(x-s*.46,y-17,s*.92,17);ctx.fillStyle="#9a7955";ctx.beginPath();ctx.arc(x,y-18,7,0,Math.PI*2);ctx.fill();ctx.fillRect(x-2,y-17,4,18)}
  else if(k==="shrine"){ctx.fillStyle="#d7d0c0";ctx.beginPath();ctx.moveTo(x-s*.4,y);ctx.lineTo(x-s*.3,y-28);ctx.lineTo(x,y-40);ctx.lineTo(x+s*.3,y-28);ctx.lineTo(x+s*.4,y);ctx.closePath();ctx.fill();ctx.fillStyle="#6f9b9f";ctx.beginPath();ctx.arc(x,y-18,8,0,Math.PI*2);ctx.fill();ctx.fillStyle="rgba(130,225,220,.35)";ctx.beginPath();ctx.arc(x,y-20,14+Math.sin(animT*.004)*2,0,Math.PI*2);ctx.fill()}
  else if(k==="watchtower"){ctx.fillStyle="#aaa69c";ctx.fillRect(x-s*.25,y-48,s*.5,48);ctx.fillStyle="#56616c";roof(x,y-49,s*.35,15);ctx.fillStyle="#44382f";ctx.fillRect(x-4,y-17,8,17);banner(x+s*.18,y-60,"#4f6f9c")}
  if(lvl>=3){ctx.strokeStyle="rgba(255,224,151,.65)";ctx.lineWidth=1.5;ctx.strokeRect(x-s*.45,y-4,s*.9,3)}
}
function roof(x,y,half,h){ctx.beginPath();ctx.moveTo(x-half,y);ctx.lineTo(x,y-h);ctx.lineTo(x+half,y);ctx.closePath();ctx.fill()}
function window(x,y){ctx.fillStyle="#f4ca70";ctx.fillRect(x-3,y-4,6,7)}
function banner(x,y,color){ctx.fillStyle="#4d3a2e";ctx.fillRect(x-1,y-5,2,20);ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(x,y-5);ctx.lineTo(x+12,y);ctx.lineTo(x,y+6);ctx.closePath();ctx.fill()}
function tower(x,y,lvl){ctx.fillStyle="#b9b4a8";ctx.fillRect(x-7,y-20-lvl*2,14,20+lvl*2);ctx.fillStyle="#445a77";roof(x,y-20-lvl*2,10,10)}
function drawCityLife(ox,oy,tw,th){const list=state.units.slice(0,Math.min(12,state.units.length));const civilians=Math.max(3,Math.min(8,(state.buildings.house||1)*2));for(let i=0;i<list.length+civilians;i++){const u=list[i]||{cls:"Civilian"},a=animT*.00015+i*1.7,gx=4.5+Math.cos(a+i*.2)*2.6,gy=4+Math.sin(a*1.31+i)*2.0,p=iso(gx,gy,ox,oy,tw,th);drawChibi(p.x,p.y-4,u.cls,i)}}
function drawChibi(x,y,cls,i){const palette={Warrior:"#557cb6",Archer:"#64845e",Mage:"#7563b2",Cleric:"#d0b978",Knight:"#6f7e98",Rogue:"#67586f",Civilian:i%2?"#8b6e4d":"#6f7f66"},body=palette[cls]||"#557cb6",bob=Math.sin(animT*.007+i)*1.4;ctx.save();ctx.translate(x,y+bob);ctx.fillStyle="rgba(0,0,0,.18)";ctx.beginPath();ctx.ellipse(0,9,10,4,0,0,Math.PI*2);ctx.fill();ctx.fillStyle=body;ctx.fillRect(-7,-8,14,17);ctx.fillStyle="#e3bea0";ctx.beginPath();ctx.arc(0,-13,7,0,Math.PI*2);ctx.fill();ctx.fillStyle="#49372d";ctx.beginPath();ctx.arc(0,-16,7,Math.PI,Math.PI*2);ctx.fill();ctx.strokeStyle="#d5dbe3";ctx.lineWidth=2;if(cls==="Warrior"||cls==="Knight"){ctx.beginPath();ctx.moveTo(7,-3);ctx.lineTo(14,-14);ctx.stroke();if(cls==="Knight"){ctx.strokeStyle="#8e9fb4";ctx.beginPath();ctx.arc(-8,-1,5,0,Math.PI*2);ctx.stroke()}}if(cls==="Archer"){ctx.strokeStyle="#d1b982";ctx.beginPath();ctx.arc(9,-5,7,-1.1,1.1);ctx.stroke()}if(cls==="Mage"||cls==="Cleric"){ctx.strokeStyle="#8b6945";ctx.beginPath();ctx.moveTo(8,3);ctx.lineTo(10,-17);ctx.stroke();ctx.fillStyle=cls==="Mage"?"#a998f0":"#ffe5a2";ctx.beginPath();ctx.arc(10,-18,3,0,Math.PI*2);ctx.fill()}if(cls==="Rogue"){ctx.beginPath();ctx.moveTo(7,-2);ctx.lineTo(13,-9);ctx.moveTo(-7,-2);ctx.lineTo(-13,-9);ctx.stroke()}ctx.restore()}
function drawTrees(ox,oy,tw,th){for(let i=0;i<14;i++){const gx=(i*3.7)%10,gy=(i*2.1)%8;if(gx>1&&gx<8&&gy>1&&gy<7)continue;const p=iso(gx,gy,ox,oy,tw,th);ctx.fillStyle="#5a4635";ctx.fillRect(p.x-2,p.y-20,4,20);ctx.fillStyle=i%2?"#3f7048":"#527f51";ctx.beginPath();ctx.arc(p.x,p.y-25,11,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(p.x-7,p.y-21,7,0,Math.PI*2);ctx.fill()}}
function drawCityFx(ox,oy,tw,th){const now=performance.now();for(let i=cityFx.length-1;i>=0;i--){const fx=cityFx[i],age=(now-fx.t)/1000;if(age>1.15){cityFx.splice(i,1);continue}const p=iso(4.8,3.8,ox,oy,tw,th);ctx.globalAlpha=1-age/1.15;ctx.fillStyle=fx.type==="recruit"?"#9fdbb4":"#e7d19a";for(let j=0;j<8;j++){const a=j*Math.PI/4+age*2,r=14+age*24;ctx.beginPath();ctx.arc(p.x+Math.cos(a)*r,p.y-18+Math.sin(a)*r*.5,2.4,0,Math.PI*2);ctx.fill()}ctx.globalAlpha=1}}
function loop(t){const dt=t-lastFrame;lastFrame=t;animT=t;if(dt<80)renderCity();requestAnimationFrame(loop)}
window.addEventListener("resize",renderCity);renderAll();requestAnimationFrame(loop);
