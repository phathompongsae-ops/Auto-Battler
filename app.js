import {BUILDINGS,UNIT_CLASSES,REGIONS,createInitialState,buildingCost,canAfford,resourceCap,armyPower,unitStats,recruit,upgradeBuilding,expeditionOutcome,resolveSeasonWar,randomEvent,seasonWarPower,updateCapitalLocks} from "./src/fantasy-core.js";

const SAVE_KEY="realmfront-save-v2";
let state=load()||createInitialState();
let activeTab="build";
let selectedTeam=new Set(state.units.slice(0,4).map(u=>u.id));
let animT=0;

const q=s=>document.querySelector(s);
const modal=q("#modal"),modalBody=q("#modalBody"),panel=q("#panelContent"),canvas=q("#cityCanvas"),ctx=canvas.getContext("2d");

function save(){localStorage.setItem(SAVE_KEY,JSON.stringify(state));toast("Game saved");}
function load(){try{const v=JSON.parse(localStorage.getItem(SAVE_KEY));return v&&v.version===2?v:null}catch{return null}}
function money(n){return Math.round(n).toLocaleString()}
function costText(c){return Object.entries(c).filter(([,v])=>v>0).map(([k,v])=>k[0].toUpperCase()+k.slice(1)+" "+v).join(" · ")}
function toast(msg){const e=q("#toast");e.textContent=msg;e.classList.add("show");clearTimeout(toast.t);toast.t=setTimeout(()=>e.classList.remove("show"),2200)}
function openModal(html){modalBody.innerHTML=html;modal.classList.remove("hidden")}
function closeModal(){modal.classList.add("hidden");modalBody.innerHTML=""}
q("#closeModal").addEventListener("click",closeModal);modal.addEventListener("click",e=>{if(e.target===modal)closeModal()});

document.querySelectorAll(".tab").forEach(b=>b.addEventListener("click",()=>{activeTab=b.dataset.tab;document.querySelectorAll(".tab").forEach(x=>x.classList.toggle("active",x===b));renderPanel()}));
q("#saveBtn").addEventListener("click",save);
q("#newBtn").addEventListener("click",()=>openModal('<div class="result-big"><h2>Start a new campaign?</h2><p>Your current save will be replaced.</p><button class="btn danger" id="confirmNew">Start New Game</button></div>')||setTimeout(()=>{},0));
document.addEventListener("click",e=>{if(e.target&&e.target.id==="confirmNew"){localStorage.removeItem(SAVE_KEY);state=createInitialState();selectedTeam=new Set(state.units.map(u=>u.id));closeModal();renderAll();toast("New campaign started")}});
q("#helpBtn").addEventListener("click",showGuide);
q("#warBtn").addEventListener("click",showSeasonWar);

function renderAll(){ensureSelections();updateCapitalLocks(state);renderHud();renderPanel();renderCity();updateWarButton();checkEnd();localStorage.setItem(SAVE_KEY,JSON.stringify(state))}
function renderHud(){
  const cap=resourceCap(state);
  q("#resourceHud").innerHTML=["gold","wood","stone","crystal"].map(k=>'<div class="res"><small>'+k.toUpperCase()+'</small><b>'+money(state.resources[k])+' / '+money(cap)+'</b></div>').join("")+'<div class="res"><small>ARMY</small><b>'+money(armyPower(state))+'</b></div>';
  q("#monthLabel").textContent="Year "+state.year+" · Month "+state.month;
  q("#seasonLabel").textContent="Season "+state.season;
  q("#cityLevel").textContent="Town Hall Lv."+state.buildings.townhall;
  const pos=(state.month-1)%3; q("#warCountdown").textContent=state.warReady?"READY":(3-pos)+" month"+(3-pos===1?"":"s");
}
function updateWarButton(){q("#warBtn").disabled=!state.warReady||state.gameOver;q("#warBtn").textContent=state.warReady?"Season War Ready":"Season War"}

function tutorialBox(){
  const steps=[
    ["Raise your settlement","Upgrade or construct a building."],
    ["Grow the army","Recruit at least one new unit."],
    ["Send an expedition","Choose 3-5 units and clear Green Fields."],
    ["Keep improving","Win battles and upgrade buildings before Season War."],
    ["Conquer the frontier","Win Season Wars, unlock capitals, conquer both rivals."]
  ];
  const s=steps[Math.min(state.tutorial,steps.length-1)];
  return '<div class="tutorial"><b>Guide '+(Math.min(state.tutorial+1,5))+'/5 — '+s[0]+'</b><br>'+s[1]+'</div>';
}

function renderPanel(){
  if(activeTab==="build") renderBuild();
  if(activeTab==="army") renderArmy();
  if(activeTab==="expedition") renderExpedition();
  if(activeTab==="territory") renderTerritory();
}

function renderBuild(){
  panel.innerHTML=tutorialBox()+'<h2 class="section-title">Settlement Development</h2><div class="card-grid">'+Object.entries(BUILDINGS).map(([k,b])=>{
    const lvl=state.buildings[k]||0,c=buildingCost(k,lvl||1),max=lvl>=b.max,aff=canAfford(state.resources,c);
    return '<div class="card"><div class="row"><div><h3>'+b.name+' <span class="pill">Lv.'+lvl+'</span></h3><p>'+b.desc+'</p><span class="cost">'+(max?"MAX LEVEL":costText(c))+'</span></div><button class="btn '+(aff?"good":"")+'" data-build="'+k+'" '+(max||!aff?"disabled":"")+'>'+(lvl?"Upgrade":"Build")+'</button></div></div>'
  }).join("")+'</div>';
  panel.querySelectorAll("[data-build]").forEach(b=>b.addEventListener("click",()=>{
    const r=upgradeBuilding(state,b.dataset.build);if(r.ok){state.tutorial=Math.max(state.tutorial,1);toast(BUILDINGS[b.dataset.build].name+" upgraded");renderAll()}else toast(r.reason)
  }));
}

function renderArmy(){
  const pop=4+(state.buildings.house||0)*3+(state.buildings.townhall||0);
  panel.innerHTML=tutorialBox()+'<div class="row"><h2 class="section-title">Army</h2><span class="pill">'+state.units.length+' / '+pop+' population</span></div><div class="stack">'+
  state.units.map(u=>{const s=unitStats(state,u);return '<div class="card unit-line"><div class="avatar">'+u.cls.slice(0,2)+'</div><div><b>'+u.cls+' #'+u.id+'</b><p>Lv.'+u.level+' · XP '+u.xp+' · Power '+s.power+'</p></div><label><input type="checkbox" data-team="'+u.id+'" '+(selectedTeam.has(u.id)?"checked":"")+'> Team</label></div>'}).join("")+
  '</div><h2 class="section-title">Recruit</h2><div class="card-grid">'+Object.entries(UNIT_CLASSES).map(([cls,c])=>{
    const lvl=state.buildings[c.need]||0,ok=lvl>=(c.needLevel||1)&&canAfford(state.resources,c.cost)&&state.units.length<pop;
    return '<div class="card"><div class="row"><div><h3>'+cls+'</h3><p>'+c.need+' Lv.'+(c.needLevel||1)+' · '+costText(c.cost)+'</p></div><button class="btn" data-recruit="'+cls+'" '+(ok?"":"disabled")+'>Recruit</button></div></div>'
  }).join("")+'</div>';
  panel.querySelectorAll("[data-team]").forEach(x=>x.addEventListener("change",()=>{const id=Number(x.dataset.team);if(x.checked){if(selectedTeam.size>=5){x.checked=false;toast("Maximum 5 units");return}selectedTeam.add(id)}else selectedTeam.delete(id)}));
  panel.querySelectorAll("[data-recruit]").forEach(b=>b.addEventListener("click",()=>{const r=recruit(state,b.dataset.recruit);if(r.ok){state.tutorial=Math.max(state.tutorial,2);toast(b.dataset.recruit+" recruited");renderAll()}else toast(r.reason)}));
}

function renderExpedition(){
  const power=armyPower(state,[...selectedTeam]);
  panel.innerHTML=tutorialBox()+'<div class="row"><h2 class="section-title">Expeditions</h2><span class="pill">Team Power '+power+'</span></div><p style="font-size:11px;color:var(--muted)">Choose 3-5 units in Army. Each expedition advances one month.</p><div class="card-grid">'+REGIONS.map((r,i)=>{
    const lock=i>0&&state.buildings.townhall<Math.min(4,i+1);
    return '<div class="card"><h3>'+r.name+' <span class="pill">Power '+r.power+'</span></h3><p>Loot: '+costText(r.reward)+' · Rival encounter '+Math.round(r.rival*100)+'%</p><button class="btn good" data-exp="'+r.id+'" '+(lock||selectedTeam.size<3?"disabled":"")+'>'+(lock?"Upgrade Town Hall":"Explore")+'</button></div>'
  }).join("")+'</div>';
  panel.querySelectorAll("[data-exp]").forEach(b=>b.addEventListener("click",()=>startExpedition(b.dataset.exp)));
}

function renderTerritory(){
  const labels={h1:"Dawnkeep",h2:"River Farms",n1:"Old Road",n2:"Sunken Mine",n3:"Crosswind",a1:"Crystal Verge",a2:"Astral Gate",d1:"Cinder March",d2:"Ash Bastion"};
  const cells=Object.entries(state.territory).map(([k,v])=>'<div class="node '+v+'"><strong>'+labels[k]+'</strong><small>'+v.toUpperCase()+'</small></div>').join("");
  panel.innerHTML='<h2 class="section-title">Frontier Territory</h2><div class="map-grid">'+cells+'</div><h2 class="section-title">Rival Factions</h2>'+["arcane","demon"].map(k=>rivalCard(k)).join("");
}
function rivalCard(k){const r=state.rivals[k];return '<div class="card faction-'+k+'"><div class="unit-line"><div class="avatar">'+(k==="arcane"?"AR":"DM")+'</div><div><b>'+r.name+'</b><p>City Lv.'+r.cityLevel+' · Army '+r.armyPower+' · Territory '+r.territory+'</p><span class="pill">'+(r.conquered?"CONQUERED":r.capitalUnlocked?"CAPITAL UNLOCKED":"Capital locked")+'</span></div></div></div>'}

function ensureSelections(){const valid=new Set(state.units.map(u=>u.id));selectedTeam=new Set([...selectedTeam].filter(id=>valid.has(id)));while(selectedTeam.size<Math.min(4,state.units.length))for(const u of state.units){selectedTeam.add(u.id);if(selectedTeam.size>=4)break}}

function startExpedition(id){
  if(state.gameOver)return;
  const region=REGIONS.find(r=>r.id===id),ids=[...selectedTeam];
  const preview=armyPower(state,ids);
  openModal('<h2>'+region.name+'</h2><p>Team Power '+preview+' · Recommended '+region.power+'</p><div id="battleStage" class="battlefield"></div><div id="battleLog" class="log">Scouts enter the region...</div><div class="row" style="margin-top:10px"><button id="resolveBattleBtn" class="btn good">Begin Auto Battle</button><button id="cancelBattleBtn" class="btn">Retreat</button></div>');
  drawBattlePreview(ids,false);
  q("#cancelBattleBtn").addEventListener("click",closeModal);
  q("#resolveBattleBtn").addEventListener("click",()=>{
    q("#resolveBattleBtn").disabled=true;
    const result=expeditionOutcome(state,region,ids);
    animateBattle(ids,result,()=>{
      if(result.win)state.tutorial=Math.max(state.tutorial,3);
      const ev=randomEvent(state);
      modalBody.innerHTML='<div class="result-big"><h2 class="'+(result.win?"victory":"defeat")+'">'+(result.win?"VICTORY":"DEFEAT")+'</h2><p>'+(result.rivalType?"You encountered the "+result.rivalType+" faction.":"You fought local monsters.")+'</p><p>Power '+result.playerPower+' vs '+result.enemyPower+'</p><p>Loot: '+costText(result.reward)+'</p>'+(ev?'<div class="card"><b>'+ev.title+'</b><p>'+ev.text+'</p></div>':'')+(result.seasonTriggered?'<p class="pill">Season War is now ready.</p>':'')+'<button id="returnBtn" class="btn good">Return to Dawnkeep</button></div>';
      q("#returnBtn").addEventListener("click",()=>{closeModal();renderAll()});
    });
  });
}

function drawBattlePreview(ids,enemyArcane){
  const stage=q("#battleStage"); if(!stage)return;
  stage.innerHTML="";
  ids.slice(0,5).forEach((id,i)=>stage.insertAdjacentHTML("beforeend",fighterHtml(10+i*8,28+(i%2)*38,false,false)));
  for(let i=0;i<4;i++)stage.insertAdjacentHTML("beforeend",fighterHtml(73+i*5,35+(i%2)*42,true,enemyArcane));
}
function fighterHtml(left,top,enemy,arcane){return '<div class="fighter '+(enemy?"enemy ":"")+(arcane?"arcane":"")+'" style="left:'+left+'%;top:'+top+'%"><div class="hp"><span style="width:100%"></span></div><div class="head"></div><div class="body"></div></div>'}
function animateBattle(ids,result,done){
  const stage=q("#battleStage"),log=q("#battleLog"); if(!stage){done();return}
  drawBattlePreview(ids,result.rivalType==="arcane");
  let tick=0;const fighters=[...stage.querySelectorAll(".fighter")];
  const timer=setInterval(()=>{
    tick++;
    fighters.forEach((f,i)=>{const enemy=f.classList.contains("enemy");f.style.left=(enemy?Math.max(50,73+i%4*5-tick*3):Math.min(46,10+i*8+tick*3))+"%";const hp=f.querySelector(".hp span");hp.style.width=Math.max(8,100-tick*(result.win&&enemy?19:result.win?8:enemy?7:19))+"%"});
    log.innerHTML+="<br>Exchange "+tick+": steel, arrows and spells collide.";
    log.scrollTop=log.scrollHeight;
    if(tick>=5){clearInterval(timer);setTimeout(done,350)}
  },260);
}

function showSeasonWar(){
  if(!state.warReady)return;
  const ids=[...selectedTeam]; if(ids.length<3){toast("Choose at least 3 units");activeTab="army";renderPanel();return}
  openModal('<h2>Season War</h2><p>Choose a rival. Victory captures territory; capital victory conquers the faction.</p><div class="card-grid">'+["arcane","demon"].map(k=>{
    const r=state.rivals[k];if(r.conquered)return '<div class="card"><h3>'+r.name+'</h3><p>Already conquered.</p></div>';
    const cap=r.capitalUnlocked;
    return '<div class="card faction-'+k+'"><h3>'+r.name+'</h3><p>Army '+seasonWarPower(state,k,false)+' · City Lv.'+r.cityLevel+' · Territory '+r.territory+'</p><button class="btn danger" data-war="'+k+'" data-capital="0">Attack Territory</button> '+(cap?'<button class="btn warn" data-war="'+k+'" data-capital="1">Assault Capital</button>':'<span class="pill">Capital locked</span>')+'</div>'
  }).join("")+'</div>');
  modalBody.querySelectorAll("[data-war]").forEach(b=>b.addEventListener("click",()=>runSeasonWar(b.dataset.war,b.dataset.capital==="1",ids)));
}
function runSeasonWar(key,capital,ids){
  const r=resolveSeasonWar(state,key,ids,Math.random,capital);if(!r.ok){toast(r.reason);return}
  modalBody.innerHTML='<div class="result-big"><h2 class="'+(r.win?"victory":"defeat")+'">'+(r.win?(capital?"CAPITAL CONQUERED":"WAR VICTORY"):"WAR DEFEAT")+'</h2><p>Army '+r.playerPower+' vs '+r.enemyPower+'</p><p>'+state.lastMessage+'</p><button id="warReturn" class="btn good">Return</button></div>';
  q("#warReturn").addEventListener("click",()=>{closeModal();renderAll()});
}

function showGuide(){openModal('<h2>How to Win</h2><div class="stack"><div class="card"><b>1. Build</b><p>Upgrade Dawnkeep. Town Hall opens harder regions; Houses increase population.</p></div><div class="card"><b>2. Explore</b><p>Send 3-5 units. Battles are automatic and each expedition advances one month.</p></div><div class="card"><b>3. Season War</b><p>Every three months choose Arcane or Demon territory to attack.</p></div><div class="card"><b>4. Capital</b><p>Win wars, reduce territory, reach Town Hall Lv.3 and Army Power 330 to unlock a capital assault.</p></div><div class="card"><b>5. Victory</b><p>Conquer both rival capitals before the end of Season 12.</p></div></div>')}

function checkEnd(){
  if(!state.gameOver)return;
  if(state.victory){
    openModal('<div class="result-big"><h2 class="victory">CAMPAIGN VICTORY</h2><p>Dawnkeep has united the frontier.</p><div class="card"><p>Seasons '+state.season+' · Battles Won '+state.stats.wins+' / '+state.stats.battles+' · Territories '+state.stats.territories+'</p><p>Final City Lv.'+state.buildings.townhall+' · Army Power '+armyPower(state)+'</p></div><button class="btn good" id="sandboxBtn">Continue Sandbox</button> <button class="btn" id="victoryNew">New Game</button></div>');
    q("#sandboxBtn").addEventListener("click",()=>{state.gameOver=false;closeModal();toast("Sandbox mode")});
    q("#victoryNew").addEventListener("click",()=>{state=createInitialState();selectedTeam=new Set(state.units.map(u=>u.id));closeModal();renderAll()});
  }else{
    openModal('<div class="result-big"><h2 class="defeat">CAMPAIGN DEFEAT</h2><p>Season 12 ends before both rival capitals fall.</p><button id="retryBtn" class="btn good">Start Again</button></div>');
    q("#retryBtn").addEventListener("click",()=>{state=createInitialState();selectedTeam=new Set(state.units.map(u=>u.id));closeModal();renderAll()});
  }
}

function renderCity(){
  const dpr=Math.min(2,window.devicePixelRatio||1),rect=canvas.getBoundingClientRect(),w=Math.max(640,rect.width),h=Math.max(330,rect.height);
  if(canvas.width!==Math.floor(w*dpr)||canvas.height!==Math.floor(h*dpr)){canvas.width=Math.floor(w*dpr);canvas.height=Math.floor(h*dpr);ctx.setTransform(dpr,0,0,dpr,0,0)}
  ctx.clearRect(0,0,w,h);
  const horizon=h*.31;
  const sky=ctx.createLinearGradient(0,0,0,horizon);sky.addColorStop(0,"#93c8e3");sky.addColorStop(1,"#d9e5c9");ctx.fillStyle=sky;ctx.fillRect(0,0,w,horizon);
  ctx.fillStyle="#61875d";ctx.fillRect(0,horizon,w,h-horizon);
  drawMountains(w,horizon);
  const tileW=Math.min(66,w/12),tileH=tileW*.52,ox=w*.5,oy=horizon+30;
  for(let gy=0;gy<8;gy++)for(let gx=0;gx<10;gx++){const x=ox+(gx-gy)*tileW/2,y=oy+(gx+gy)*tileH/2;diamond(x,y,tileW,tileH,(gx+gy)%2?"#759b67":"#7ea66f","#628755")}
  drawRoad(ox,oy,tileW,tileH);
  const entries=Object.entries(state.buildings).filter(([,lvl])=>lvl>0);
  entries.forEach(([k,lvl],i)=>{const gx=1+(i*2)%9,gy=1+Math.floor(i/5)*3+(i%2);const p=iso(gx,gy,ox,oy,tileW,tileH);drawBuilding(p.x,p.y,k,lvl,tileW)});
  const walkers=Math.min(14,state.units.length+3);
  for(let i=0;i<walkers;i++){const a=animT*.00015+i*1.9,gx=4.4+Math.cos(a)*2.8,gy=4+Math.sin(a*1.23)*2.2,p=iso(gx,gy,ox,oy,tileW,tileH);drawChibi(p.x,p.y-4,i)}
  drawTrees(w,h,ox,oy,tileW,tileH);
}
function iso(gx,gy,ox,oy,tw,th){return{x:ox+(gx-gy)*tw/2,y:oy+(gx+gy)*th/2}}
function diamond(x,y,w,h,fill,stroke){ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+w/2,y+h/2);ctx.lineTo(x,y+h);ctx.lineTo(x-w/2,y+h/2);ctx.closePath();ctx.fillStyle=fill;ctx.fill();ctx.strokeStyle=stroke;ctx.stroke()}
function drawMountains(w,y){ctx.fillStyle="#70848a";for(let i=0;i<7;i++){const x=i*w/6-40,hh=35+(i%3)*16;ctx.beginPath();ctx.moveTo(x-85,y);ctx.lineTo(x,y-hh);ctx.lineTo(x+95,y);ctx.closePath();ctx.fill()}ctx.fillStyle="rgba(255,255,255,.5)";ctx.beginPath();ctx.arc(w*.78,y*.27,26,0,Math.PI*2);ctx.fill()}
function drawRoad(ox,oy,tw,th){ctx.strokeStyle="#a89268";ctx.lineWidth=Math.max(7,tw*.14);ctx.lineCap="round";const a=iso(0,5,ox,oy,tw,th),b=iso(9,5,ox,oy,tw,th);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke()}
function drawBuilding(x,y,k,lvl,scale){const palette={townhall:["#d6d0bd","#5e7392"],house:["#d9c49d","#8a5e49"],barracks:["#c9b58f","#813f3f"],archery:["#cab991","#58744f"],chapel:["#d9d3c6","#6a5b9b"],blacksmith:["#9e9b92","#4b4f55"],warehouse:["#bb9b72","#6e523b"],training:["#a9a58c","#79583e"],shrine:["#d7d0bf","#678b91"],watchtower:["#b8b0a1","#5d6670"]}[k]||["#ccc","#777"];
  const w=scale*(.62+lvl*.05),h=24+lvl*5;ctx.fillStyle="rgba(0,0,0,.18)";ctx.beginPath();ctx.ellipse(x,y+12,w*.7,8,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle=palette[0];ctx.fillRect(x-w/2,y-h,w,h);ctx.strokeStyle="#414552";ctx.strokeRect(x-w/2,y-h,w,h);
  ctx.fillStyle=palette[1];ctx.beginPath();ctx.moveTo(x-w*.62,y-h);ctx.lineTo(x,y-h-18-lvl*2);ctx.lineTo(x+w*.62,y-h);ctx.closePath();ctx.fill();
  ctx.fillStyle="#372b24";ctx.fillRect(x-6,y-14,12,14);ctx.fillStyle="#f4c96b";ctx.fillRect(x+w*.19,y-h+8,7,7);
  if(lvl>=3){ctx.fillStyle="#42689b";ctx.fillRect(x+w*.48,y-h-30,3,25);ctx.beginPath();ctx.moveTo(x+w*.51,y-h-30);ctx.lineTo(x+w*.82,y-h-24);ctx.lineTo(x+w*.51,y-h-18);ctx.fill()}
}
function drawChibi(x,y,i){const colors=["#41699a","#7b5d3f","#557c55","#735990","#b4824a"];ctx.fillStyle="rgba(0,0,0,.18)";ctx.beginPath();ctx.ellipse(x,y+8,10,4,0,0,Math.PI*2);ctx.fill();ctx.fillStyle=colors[i%colors.length];ctx.fillRect(x-7,y-10,14,18);ctx.fillStyle="#e5c4a4";ctx.beginPath();ctx.arc(x,y-14,7,0,Math.PI*2);ctx.fill();ctx.fillStyle="#4d3a2d";ctx.beginPath();ctx.arc(x,y-17,7,Math.PI,Math.PI*2);ctx.fill()}
function drawTrees(w,h,ox,oy,tw,th){for(let i=0;i<11;i++){const gx=(i*3.7)%10,gy=(i*2.1)%8;if(gx>1&&gx<8&&gy>1&&gy<7)continue;const p=iso(gx,gy,ox,oy,tw,th);ctx.fillStyle="#5a4635";ctx.fillRect(p.x-2,p.y-20,4,20);ctx.fillStyle=i%2?"#3f6f48":"#527f51";ctx.beginPath();ctx.arc(p.x,p.y-25,11,0,Math.PI*2);ctx.fill()}}
function loop(t){animT=t;renderCity();requestAnimationFrame(loop)}
window.addEventListener("resize",renderCity);
renderAll();requestAnimationFrame(loop);
