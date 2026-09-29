export const BUILDINGS = {
  townhall:{name:"Town Hall",base:{gold:0,wood:0,stone:0,crystal:0},scale:1.65,max:5,desc:"Raises city level and unlocks progression."},
  house:{name:"House",base:{gold:35,wood:55,stone:15,crystal:0},scale:1.45,max:4,desc:"Adds population capacity."},
  barracks:{name:"Barracks",base:{gold:70,wood:70,stone:45,crystal:0},scale:1.5,max:4,desc:"Recruit Warriors and Knights."},
  archery:{name:"Archery Range",base:{gold:65,wood:85,stone:25,crystal:0},scale:1.5,max:4,desc:"Recruit Archers and Rogues."},
  chapel:{name:"Arcane Chapel",base:{gold:85,wood:40,stone:45,crystal:25},scale:1.55,max:4,desc:"Recruit Mages and Clerics."},
  blacksmith:{name:"Blacksmith",base:{gold:90,wood:35,stone:80,crystal:10},scale:1.55,max:4,desc:"Improves army attack and defense."},
  warehouse:{name:"Warehouse",base:{gold:45,wood:85,stone:45,crystal:0},scale:1.45,max:4,desc:"Increases resource caps."},
  training:{name:"Training Ground",base:{gold:80,wood:60,stone:45,crystal:10},scale:1.5,max:4,desc:"Improves XP gained from battle."},
  shrine:{name:"Healing Shrine",base:{gold:80,wood:35,stone:55,crystal:20},scale:1.5,max:4,desc:"Improves recovery and support."},
  watchtower:{name:"Watch Tower",base:{gold:70,wood:55,stone:70,crystal:0},scale:1.5,max:4,desc:"Helps reveal and defend the frontier."}
};

export const UNIT_CLASSES = {
  Warrior:{hp:120,atk:24,def:18,spd:9,cost:{gold:45,wood:0,stone:10,crystal:0},need:"barracks",color:"#557cb6"},
  Archer:{hp:82,atk:29,def:9,spd:13,cost:{gold:50,wood:20,stone:0,crystal:0},need:"archery",color:"#64845e"},
  Mage:{hp:72,atk:38,def:7,spd:10,cost:{gold:60,wood:0,stone:0,crystal:18},need:"chapel",color:"#7563b2"},
  Cleric:{hp:92,atk:18,def:12,spd:10,cost:{gold:55,wood:0,stone:10,crystal:12},need:"chapel",color:"#d0b978"},
  Knight:{hp:150,atk:32,def:25,spd:8,cost:{gold:90,wood:0,stone:30,crystal:0},need:"barracks",needLevel:2,color:"#6f7e98"},
  Rogue:{hp:78,atk:36,def:8,spd:17,cost:{gold:75,wood:15,stone:0,crystal:5},need:"archery",needLevel:2,color:"#67586f"}
};

export const REGIONS = [
  {id:"fields",name:"Green Fields",power:62,reward:{gold:62,wood:58,stone:22,crystal:2},rival:.12},
  {id:"forest",name:"Ancient Forest",power:120,reward:{gold:92,wood:84,stone:38,crystal:7},rival:.20},
  {id:"pass",name:"Rocky Pass",power:195,reward:{gold:125,wood:48,stone:94,crystal:12},rival:.28},
  {id:"ruins",name:"Crystal Ruins",power:285,reward:{gold:165,wood:48,stone:64,crystal:32},rival:.36},
  {id:"frontier",name:"Dark Frontier",power:400,reward:{gold:225,wood:78,stone:100,crystal:44},rival:.45}
];

export function createInitialState(){
  return {
    version:2,year:1,month:1,season:1,turn:0,warReady:false,pendingWarSeason:null,gameOver:false,victory:false,sandbox:false,
    resources:{gold:250,wood:235,stone:160,crystal:42},
    buildings:{townhall:1,house:1,barracks:1,archery:1,chapel:1,blacksmith:0,warehouse:0,training:0,shrine:0,watchtower:0},
    units:[makeUnit("Warrior",1),makeUnit("Warrior",2),makeUnit("Archer",3),makeUnit("Cleric",4)],
    nextUnitId:5,
    rivals:{
      arcane:{name:"Arcane Covenant",cityLevel:1,armyPower:112,resources:180,territory:3,warWins:0,capitalUnlocked:false,conquered:false},
      demon:{name:"Ashen Horde",cityLevel:1,armyPower:122,resources:180,territory:3,warWins:0,capitalUnlocked:false,conquered:false}
    },
    territory:{h1:"human",h2:"human",n1:"neutral",n2:"neutral",n3:"neutral",a1:"arcane",a2:"arcane",d1:"demon",d2:"demon"},
    stats:{battles:0,wins:0,losses:0,expeditions:0,territories:0,seasonWars:0},
    tutorial:0,eventsSeen:0,lastMessage:"Build your settlement and prepare for the first expedition."
  };
}
export function normalizeState(s){
  if(!s||s.version!==2)return createInitialState();
  s.pendingWarSeason??=s.warReady?Math.max(1,s.season-1):null;s.sandbox??=false;
  s.stats.losses??=Math.max(0,(s.stats.battles||0)-(s.stats.wins||0));
  return s;
}
export function makeUnit(cls,id){return {id,cls,level:1,xp:0}}
export function buildingCost(key,level){
  const b=BUILDINGS[key],m=Math.pow(b.scale,Math.max(0,level-1)),out={};
  for(const k of ["gold","wood","stone","crystal"])out[k]=Math.round(b.base[k]*m);
  if(key==="townhall"&&level>=1){out.gold=110*level;out.wood=95*level;out.stone=82*level;out.crystal=16*level}
  return out;
}
export function canAfford(resources,cost){return Object.keys(cost).every(k=>(resources[k]||0)>=cost[k])}
export function spend(resources,cost){for(const k of Object.keys(cost))resources[k]-=cost[k]}
export function gain(resources,reward,cap=9999){for(const k of Object.keys(reward))resources[k]=Math.min(cap,(resources[k]||0)+reward[k])}
export function resourceCap(state){return 1000+(state.buildings.warehouse||0)*700}
export function unitStats(state,u){
  const base=UNIT_CLASSES[u.cls],mult=1+(u.level-1)*.13,forge=1+(state.buildings.blacksmith||0)*.06;
  return {hp:Math.round(base.hp*mult*forge),atk:Math.round(base.atk*mult*forge),def:Math.round(base.def*mult*forge),spd:base.spd,power:Math.round((base.hp*.24+base.atk*2+base.def*1.35+base.spd)*mult*forge)};
}
export function armyPower(state,ids=state.units.map(u=>u.id)){return state.units.filter(u=>ids.includes(u.id)).reduce((n,u)=>n+unitStats(state,u).power,0)}
export function strongestUnit(state){return [...state.units].sort((a,b)=>unitStats(state,b).power-unitStats(state,a).power)[0]||null}
export function recruit(state,cls){
  const c=UNIT_CLASSES[cls];if(!c)return {ok:false,reason:"Unknown class"};
  const lvl=state.buildings[c.need]||0;if(lvl<(c.needLevel||1))return {ok:false,reason:"Building requirement not met"};
  if(!canAfford(state.resources,c.cost))return {ok:false,reason:"Not enough resources"};
  const popCap=4+(state.buildings.house||0)*3+(state.buildings.townhall||0);
  if(state.units.length>=popCap)return {ok:false,reason:"Population cap reached"};
  spend(state.resources,c.cost);state.units.push(makeUnit(cls,state.nextUnitId++));return {ok:true};
}
export function upgradeBuilding(state,key){
  const lvl=state.buildings[key]||0,b=BUILDINGS[key];if(!b||lvl>=b.max)return {ok:false,reason:"Max level"};
  const cost=buildingCost(key,lvl||1);if(!canAfford(state.resources,cost))return {ok:false,reason:"Not enough resources"};
  spend(state.resources,cost);state.buildings[key]=lvl+1;return {ok:true,cost};
}
export function enemyPowerForExpedition(state,region,rivalType=null){
  const scale=1+(Math.max(0,state.season-1))*.055,rival=rivalType?state.rivals[rivalType]:null;
  return Math.round(region.power*scale*(rival?1.08+rival.cityLevel*.025:1));
}
export function resolveBattle(playerPower,enemyPower,rng=Math.random){
  const p=playerPower*(.91+rng()*.18),e=enemyPower*(.91+rng()*.18),win=p>=e;
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
  if(state.warReady)return {blocked:true,seasonTriggered:false};
  state.turn++;const previousSeason=state.season;state.month++;
  if(state.month>12){state.month=1;state.year++}
  state.season=(state.year-1)*4+Math.floor((state.month-1)/3)+1;
  const seasonTriggered=state.season>previousSeason;
  if(seasonTriggered){state.warReady=true;state.pendingWarSeason=previousSeason}
  progressRivals(state);return {blocked:false,seasonTriggered};
}
export function progressRivals(state){
  for(const key of ["arcane","demon"]){
    const r=state.rivals[key];if(r.conquered)continue;
    const growth=11+state.season*2.6+r.cityLevel*3;
    r.armyPower+=Math.round(growth);r.resources+=32+state.season*5;
    if(state.season%2===0&&r.cityLevel<5)r.cityLevel++;
  }
  updateCapitalLocks(state);
}
export function updateCapitalLocks(state){
  const th=state.buildings.townhall||0,p=armyPower(state);
  for(const key of ["arcane","demon"]){
    const r=state.rivals[key];
    if(!r.conquered&&r.warWins>=2&&r.territory<=1&&th>=3&&p>=330)r.capitalUnlocked=true;
  }
}
export function seasonWarPower(state,key,capital=false){
  const r=state.rivals[key];return Math.round(r.armyPower*(capital?1.38:1.02));
}
export function resolveSeasonWar(state,key,ids,rng=Math.random,capital=false){
  const r=state.rivals[key];
  if(!state.warReady)return {ok:false,reason:"Season War is not ready"};
  if(!r||r.conquered)return {ok:false,reason:"Faction unavailable"};
  if(capital&&!r.capitalUnlocked)return {ok:false,reason:"Capital assault is locked"};
  const pp=armyPower(state,ids),ep=seasonWarPower(state,key,capital),battle=resolveBattle(pp,ep,rng);
  state.stats.battles++;state.stats.seasonWars++;if(battle.win)state.stats.wins++;else state.stats.losses++;
  if(battle.win){
    r.warWins++;const reward=capital?{gold:430,wood:230,stone:250,crystal:105}:{gold:190,wood:105,stone:105,crystal:38};
    gain(state.resources,reward,resourceCap(state));
    if(capital){r.conquered=true;r.territory=0;claimFactionTerritory(state,key);state.lastMessage=r.name+" capital has fallen!";}
    else{captureOne(state,key);r.territory=Math.max(1,r.territory-1);state.lastMessage="Season War victory against "+r.name+"."}
    grantXp(state,ids,capital?100:62);
  }else{
    state.resources.gold=Math.max(0,state.resources.gold-35);
    gain(state.resources,{wood:18,stone:10,crystal:0,gold:0},resourceCap(state));
    state.lastMessage="Season War lost. Dawnkeep holds, and survivors return with salvage.";
  }
  state.warReady=false;state.pendingWarSeason=null;updateCapitalLocks(state);
  if(state.rivals.arcane.conquered&&state.rivals.demon.conquered){state.victory=true;state.gameOver=true}
  if(state.season>12&&!state.victory&&!state.sandbox)state.gameOver=true;
  return {ok:true,...battle,playerPower:pp,enemyPower:ep,capital};
}
function captureOne(state,key){
  const target=Object.keys(state.territory).find(k=>state.territory[k]===key);
  if(target){state.territory[target]="human";state.stats.territories++}
  else{const neutral=Object.keys(state.territory).find(k=>state.territory[k]==="neutral");if(neutral){state.territory[neutral]="human";state.stats.territories++}}
}
function claimFactionTerritory(state,key){for(const k of Object.keys(state.territory))if(state.territory[k]===key)state.territory[k]="human"}
export function expeditionOutcome(state,region,ids,rng=Math.random){
  if(state.warReady)return {ok:false,reason:"Resolve the Season War before another expedition"};
  if(ids.length<3||ids.length>5)return {ok:false,reason:"Choose 3-5 units"};
  const rivalRoll=rng(),rivalType=rivalRoll<region.rival/2?"arcane":rivalRoll<region.rival?"demon":null;
  const enemyPower=enemyPowerForExpedition(state,region,rivalType),pp=armyPower(state,ids),battle=resolveBattle(pp,enemyPower,rng);
  state.stats.battles++;state.stats.expeditions++;if(battle.win)state.stats.wins++;else state.stats.losses++;
  let reward={gold:0,wood:0,stone:0,crystal:0};
  if(battle.win){
    const factor=.88+rng()*.24;for(const k of Object.keys(reward))reward[k]=Math.round(region.reward[k]*factor);
    if(rivalType)reward.gold+=38;gain(state.resources,reward,resourceCap(state));grantXp(state,ids,32+REGIONS.indexOf(region)*10);
    state.lastMessage=(rivalType?"Rival patrol defeated. ":"Expedition cleared. ")+"Loot returned to Dawnkeep.";
  }else{
    const consolation={gold:8,wood:14+REGIONS.indexOf(region)*3,stone:7,crystal:0};
    gain(state.resources,consolation,resourceCap(state));reward=consolation;
    state.lastMessage="Expedition failed, but survivors recovered a few supplies.";
  }
  const advance=advanceMonth(state);return {ok:true,...battle,playerPower:pp,enemyPower,reward,rivalType,seasonTriggered:advance.seasonTriggered};
}
export function randomEvent(state,rng=Math.random){
  if(rng()>.26)return null;
  const events=[
    {title:"Lost Adventurer",text:"A wandering fighter joins your cause.",apply:s=>{const cap=4+(s.buildings.house||0)*3+(s.buildings.townhall||0);if(s.units.length<cap)s.units.push(makeUnit("Warrior",s.nextUnitId++));else gain(s.resources,{gold:45,wood:0,stone:0,crystal:0},resourceCap(s));}},
    {title:"Resource Discovery",text:"Scouts uncover a hidden cache.",apply:s=>gain(s.resources,{gold:62,wood:48,stone:38,crystal:8},resourceCap(s))},
    {title:"Festival",text:"A frontier festival raises morale and brings gifts.",apply:s=>gain(s.resources,{gold:78,wood:22,stone:0,crystal:4},resourceCap(s))},
    {title:"Ancient Treasure",text:"A sealed reliquary contains rare crystal.",apply:s=>gain(s.resources,{gold:38,wood:0,stone:16,crystal:19},resourceCap(s))}
  ];
  const e=events[Math.floor(rng()*events.length)];e.apply(state);state.eventsSeen++;return {title:e.title,text:e.text};
}
