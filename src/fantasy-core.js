export const BUILDINGS = {
  townhall:{name:"Town Hall",icon:"TH",base:{gold:0,wood:0,stone:0,crystal:0},scale:1.65,max:5,desc:"Raises city level and unlocks progression."},
  house:{name:"House",icon:"H",base:{gold:35,wood:55,stone:15,crystal:0},scale:1.45,max:4,desc:"Adds population capacity."},
  barracks:{name:"Barracks",icon:"B",base:{gold:70,wood:70,stone:45,crystal:0},scale:1.5,max:4,desc:"Recruit Warriors and Knights."},
  archery:{name:"Archery Range",icon:"A",base:{gold:65,wood:85,stone:25,crystal:0},scale:1.5,max:4,desc:"Recruit Archers and Rogues."},
  chapel:{name:"Arcane Chapel",icon:"C",base:{gold:85,wood:40,stone:45,crystal:25},scale:1.55,max:4,desc:"Recruit Mages and Clerics."},
  blacksmith:{name:"Blacksmith",icon:"BS",base:{gold:90,wood:35,stone:80,crystal:10},scale:1.55,max:4,desc:"Improves army attack and defense."},
  warehouse:{name:"Warehouse",icon:"W",base:{gold:45,wood:85,stone:45,crystal:0},scale:1.45,max:4,desc:"Increases resource caps."},
  training:{name:"Training Ground",icon:"TG",base:{gold:80,wood:60,stone:45,crystal:10},scale:1.5,max:4,desc:"Improves XP gained from battle."},
  shrine:{name:"Healing Shrine",icon:"S",base:{gold:80,wood:35,stone:55,crystal:20},scale:1.5,max:4,desc:"Improves expedition recovery."},
  watchtower:{name:"Watch Tower",icon:"WT",base:{gold:70,wood:55,stone:70,crystal:0},scale:1.5,max:4,desc:"Reveals stronger expeditions and helps defense."}
};

export const UNIT_CLASSES = {
  Warrior:{hp:120,atk:24,def:18,spd:9,cost:{gold:45,wood:0,stone:10,crystal:0},need:"barracks",color:"#557cb6"},
  Archer:{hp:82,atk:29,def:9,spd:13,cost:{gold:50,wood:20,stone:0,crystal:0},need:"archery",color:"#6b9a66"},
  Mage:{hp:72,atk:38,def:7,spd:10,cost:{gold:60,wood:0,stone:0,crystal:18},need:"chapel",color:"#7563b2"},
  Cleric:{hp:92,atk:18,def:12,spd:10,cost:{gold:55,wood:0,stone:10,crystal:12},need:"chapel",color:"#d3b56f"},
  Knight:{hp:150,atk:32,def:25,spd:8,cost:{gold:90,wood:0,stone:30,crystal:0},need:"barracks",needLevel:2,color:"#49688f"},
  Rogue:{hp:78,atk:36,def:8,spd:17,cost:{gold:75,wood:15,stone:0,crystal:5},need:"archery",needLevel:2,color:"#7b657f"}
};

export const REGIONS = [
  {id:"fields",name:"Green Fields",power:65,reward:{gold:55,wood:55,stone:20,crystal:2},rival:.12},
  {id:"forest",name:"Ancient Forest",power:125,reward:{gold:85,wood:80,stone:35,crystal:7},rival:.20},
  {id:"pass",name:"Rocky Pass",power:205,reward:{gold:115,wood:45,stone:90,crystal:11},rival:.28},
  {id:"ruins",name:"Crystal Ruins",power:300,reward:{gold:150,wood:45,stone:60,crystal:30},rival:.36},
  {id:"frontier",name:"Dark Frontier",power:420,reward:{gold:210,wood:75,stone:95,crystal:42},rival:.45}
];

export const CLASS_UNLOCKS = {Warrior:1,Archer:1,Mage:1,Cleric:1,Knight:2,Rogue:2};

export function createInitialState(){
  return {
    version:2,year:1,month:1,season:1,turn:0,warReady:false,gameOver:false,victory:false,
    resources:{gold:220,wood:210,stone:145,crystal:35},
    buildings:{townhall:1,house:1,barracks:1,archery:1,chapel:1,blacksmith:0,warehouse:0,training:0,shrine:0,watchtower:0},
    units:[
      makeUnit("Warrior",1),makeUnit("Warrior",2),makeUnit("Archer",3),makeUnit("Cleric",4)
    ],
    nextUnitId:5,
    rivals:{
      arcane:{name:"Arcane Covenant",cityLevel:1,armyPower:115,resources:180,territory:3,warWins:0,capitalUnlocked:false,conquered:false},
      demon:{name:"Ashen Horde",cityLevel:1,armyPower:125,resources:180,territory:3,warWins:0,capitalUnlocked:false,conquered:false}
    },
    territory:{
      h1:"human",h2:"human",n1:"neutral",n2:"neutral",n3:"neutral",a1:"arcane",a2:"arcane",d1:"demon",d2:"demon"
    },
    stats:{battles:0,wins:0,expeditions:0,territories:0,seasonWars:0},
    tutorial:0,eventsSeen:0,lastMessage:"Build your settlement and prepare for the first expedition."
  };
}

export function makeUnit(cls,id){
  return {id,cls,level:1,xp:0};
}

export function buildingCost(key,level){
  const b=BUILDINGS[key],m=Math.pow(b.scale,Math.max(0,level-1));
  const out={}; for(const k of ["gold","wood","stone","crystal"]) out[k]=Math.round(b.base[k]*m);
  if(key==="townhall" && level>=1){out.gold=120*level;out.wood=100*level;out.stone=90*level;out.crystal=18*level}
  return out;
}

export function canAfford(resources,cost){return Object.keys(cost).every(k=>(resources[k]||0)>=cost[k])}
export function spend(resources,cost){for(const k of Object.keys(cost)) resources[k]-=cost[k]}
export function gain(resources,reward,cap=9999){for(const k of Object.keys(reward)) resources[k]=Math.min(cap,(resources[k]||0)+reward[k])}

export function resourceCap(state){return 999 + (state.buildings.warehouse||0)*650}

export function unitStats(state,u){
  const base=UNIT_CLASSES[u.cls],mult=1+(u.level-1)*.13;
  const forge=1+(state.buildings.blacksmith||0)*.06;
  return {hp:Math.round(base.hp*mult*forge),atk:Math.round(base.atk*mult*forge),def:Math.round(base.def*mult*forge),spd:base.spd,power:Math.round((base.hp*.24+base.atk*2+base.def*1.35+base.spd)*mult*forge)};
}

export function armyPower(state,ids=state.units.map(u=>u.id)){
  return state.units.filter(u=>ids.includes(u.id)).reduce((n,u)=>n+unitStats(state,u).power,0);
}

export function recruit(state,cls){
  const c=UNIT_CLASSES[cls],lvl=state.buildings[c.need]||0;
  if(!c || lvl<(c.needLevel||1)) return {ok:false,reason:"Building requirement not met"};
  if(!canAfford(state.resources,c.cost)) return {ok:false,reason:"Not enough resources"};
  const popCap=4+(state.buildings.house||0)*3+(state.buildings.townhall||0);
  if(state.units.length>=popCap) return {ok:false,reason:"Population cap reached"};
  spend(state.resources,c.cost); state.units.push(makeUnit(cls,state.nextUnitId++));
  return {ok:true};
}

export function upgradeBuilding(state,key){
  const lvl=state.buildings[key]||0,b=BUILDINGS[key];
  if(!b || lvl>=b.max) return {ok:false,reason:"Max level"};
  if(key!=="townhall" && lvl===0 && state.buildings.townhall<1) return {ok:false,reason:"Town Hall required"};
  const cost=buildingCost(key,lvl||1);
  if(!canAfford(state.resources,cost)) return {ok:false,reason:"Not enough resources"};
  spend(state.resources,cost); state.buildings[key]=lvl+1;
  return {ok:true};
}

export function enemyPowerForExpedition(state,region,rivalType=null){
  const scale=1+(state.season-1)*.07;
  const rival=rivalType?state.rivals[rivalType]:null;
  return Math.round(region.power*scale*(rival?1.12+rival.cityLevel*.035:1));
}

export function resolveBattle(playerPower,enemyPower,rng=Math.random){
  const p=playerPower*(.9+rng()*.2),e=enemyPower*(.9+rng()*.2);
  const win=p>=e;
  return {win,playerRoll:Math.round(p),enemyRoll:Math.round(e),ratio:p/Math.max(1,e)};
}

export function grantXp(state,ids,base){
  const bonus=1+(state.buildings.training||0)*.12;
  for(const u of state.units.filter(x=>ids.includes(x.id))){
    u.xp+=Math.round(base*bonus);
    while(u.xp>=100+u.level*35){u.xp-=100+u.level*35;u.level++}
  }
}

export function advanceMonth(state){
  state.turn++; state.month++;
  if(state.month>12){state.month=1;state.year++}
  const seasonIndex=Math.floor((state.month-1)/3)+1;
  state.season=(state.year-1)*4+seasonIndex;
  if([4,7,10,1].includes(state.month) && state.turn>0) state.warReady=true;
  progressRivals(state);
  return state.warReady;
}

export function progressRivals(state){
  for(const key of ["arcane","demon"]){
    const r=state.rivals[key]; if(r.conquered) continue;
    const growth=14+state.season*3+r.cityLevel*4;
    r.armyPower+=growth;
    r.resources+=35+state.season*6;
    if(state.season%2===0 && r.cityLevel<5) r.cityLevel++;
  }
  updateCapitalLocks(state);
}

export function updateCapitalLocks(state){
  const th=state.buildings.townhall||0,p=armyPower(state);
  for(const key of ["arcane","demon"]){
    const r=state.rivals[key];
    if(!r.conquered && r.warWins>=2 && r.territory<=1 && th>=3 && p>=330) r.capitalUnlocked=true;
  }
}

export function seasonWarPower(state,key,capital=false){
  const r=state.rivals[key];
  return Math.round(r.armyPower*(capital?1.45:1.05));
}

export function resolveSeasonWar(state,key,ids,rng=Math.random,capital=false){
  const r=state.rivals[key];
  if(!state.warReady) return {ok:false,reason:"Season War is not ready"};
  if(r.conquered) return {ok:false,reason:"Faction already conquered"};
  if(capital && !r.capitalUnlocked) return {ok:false,reason:"Capital assault is locked"};
  const pp=armyPower(state,ids),ep=seasonWarPower(state,key,capital),battle=resolveBattle(pp,ep,rng);
  state.stats.battles++; state.stats.seasonWars++; if(battle.win) state.stats.wins++;
  if(battle.win){
    r.warWins++;
    const reward=capital?{gold:420,wood:220,stone:240,crystal:100}:{gold:180,wood:100,stone:100,crystal:35};
    gain(state.resources,reward,resourceCap(state));
    if(capital){r.conquered=true;r.territory=0;claimFactionTerritory(state,key);state.lastMessage=r.name+" capital has fallen!";}
    else {captureOne(state,key);r.territory=Math.max(1,r.territory-1);state.lastMessage="Season War victory against "+r.name+"."}
    grantXp(state,ids,capital?95:60);
  } else {
    state.resources.gold=Math.max(0,state.resources.gold-45);
    state.lastMessage="Season War lost. Your city survives, but some gold was lost.";
  }
  state.warReady=false;
  updateCapitalLocks(state);
  if(state.rivals.arcane.conquered&&state.rivals.demon.conquered){state.victory=true;state.gameOver=true}
  if(state.season>=12&&!state.victory){state.gameOver=true}
  return {ok:true,...battle,playerPower:pp,enemyPower:ep,capital};
}

function captureOne(state,key){
  const target=Object.keys(state.territory).find(k=>state.territory[k]===key);
  if(target){state.territory[target]="human";state.stats.territories++}
  else {
    const neutral=Object.keys(state.territory).find(k=>state.territory[k]==="neutral");
    if(neutral){state.territory[neutral]="human";state.stats.territories++}
  }
}
function claimFactionTerritory(state,key){for(const k of Object.keys(state.territory)) if(state.territory[k]===key) state.territory[k]="human"}

export function expeditionOutcome(state,region,ids,rng=Math.random){
  if(ids.length<3||ids.length>5) return {ok:false,reason:"Choose 3-5 units"};
  const rivalRoll=rng(),rivalType=rivalRoll<region.rival/2?"arcane":rivalRoll<region.rival?"demon":null;
  const enemyPower=enemyPowerForExpedition(state,region,rivalType);
  const pp=armyPower(state,ids),battle=resolveBattle(pp,enemyPower,rng);
  state.stats.battles++;state.stats.expeditions++;if(battle.win)state.stats.wins++;
  let reward={gold:0,wood:0,stone:0,crystal:0};
  if(battle.win){
    const factor=.85+rng()*.3;
    for(const k of Object.keys(reward)) reward[k]=Math.round(region.reward[k]*factor);
    if(rivalType) reward.gold+=35;
    gain(state.resources,reward,resourceCap(state));
    grantXp(state,ids,30+REGIONS.indexOf(region)*10);
    state.lastMessage=(rivalType?"Rival patrol defeated. ":"Expedition cleared. ")+"Loot returned to Dawnkeep.";
  } else {
    const consolation={wood:10+REGIONS.indexOf(region)*3,stone:5};
    gain(state.resources,consolation,resourceCap(state));reward=consolation;
    state.lastMessage="Expedition failed, but survivors recovered a few supplies.";
  }
  const seasonTriggered=advanceMonth(state);
  return {ok:true,...battle,playerPower:pp,enemyPower,reward,rivalType,seasonTriggered};
}

export function randomEvent(state,rng=Math.random){
  if(rng()>.28) return null;
  const events=[
    {title:"Lost Adventurer",text:"A wandering fighter joins your cause.",apply:s=>{s.units.push(makeUnit("Warrior",s.nextUnitId++));}},
    {title:"Resource Discovery",text:"Scouts uncover a hidden cache.",apply:s=>gain(s.resources,{gold:60,wood:45,stone:35,crystal:8},resourceCap(s))},
    {title:"Festival",text:"A small festival raises morale and yields gifts.",apply:s=>gain(s.resources,{gold:75,wood:20,stone:0,crystal:4},resourceCap(s))},
    {title:"Ancient Treasure",text:"A sealed chest contains rare crystal.",apply:s=>gain(s.resources,{gold:35,wood:0,stone:15,crystal:18},resourceCap(s))}
  ];
  const e=events[Math.floor(rng()*events.length)];e.apply(state);state.eventsSeen++;return {title:e.title,text:e.text};
}
