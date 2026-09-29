import test from "node:test";
import assert from "node:assert/strict";
import {createInitialState,normalizeState,buildingCost,upgradeBuilding,recruit,REGIONS,expeditionOutcome,resolveSeasonWar,armyPower,advanceMonth,updateCapitalLocks} from "../src/fantasy-core.js";

const fixed=(...vals)=>{let i=0;return()=>vals[i++%vals.length]};

test("initial state is playable and serializable",()=>{
  const s=createInitialState(),round=normalizeState(JSON.parse(JSON.stringify(s)));
  assert.equal(round.buildings.townhall,1);assert.ok(round.resources.gold>=200);assert.equal(round.units.length,4);assert.ok(armyPower(round)>0);
});

test("building cost scales and upgrade spends resources",()=>{
  const s=createInitialState(),c1=buildingCost("house",1),c2=buildingCost("house",2),before=s.resources.wood;
  assert.ok(c2.wood>c1.wood);const r=upgradeBuilding(s,"house");assert.equal(r.ok,true);assert.equal(s.buildings.house,2);assert.ok(s.resources.wood<before);
});

test("recruitment succeeds and population cap is enforced",()=>{
  const s=createInitialState();assert.equal(recruit(s,"Warrior").ok,true);
  while(recruit(s,"Warrior").ok){}
  assert.ok(s.units.length<=4+s.buildings.house*3+s.buildings.townhall);
});

test("expedition victory advances month and grants progress",()=>{
  const s=createInitialState(),ids=s.units.map(u=>u.id),before=s.month;
  const r=expeditionOutcome(s,REGIONS[0],ids,fixed(.99,.99,.01,.5));
  assert.equal(r.ok,true);assert.equal(r.win,true);assert.notEqual(s.month,before);assert.equal(s.stats.expeditions,1);
});

test("expedition defeat still returns consolation loot",()=>{
  const s=createInitialState(),ids=s.units.map(u=>u.id);s.units.forEach(u=>u.level=1);
  const impossible={...REGIONS[4],power:9999};const r=expeditionOutcome(s,impossible,ids,fixed(.99,.01,.99));
  assert.equal(r.ok,true);assert.equal(r.win,false);assert.ok(r.reward.wood>0);assert.equal(s.stats.losses,1);
});

test("season war triggers after completing three months and blocks further expedition",()=>{
  const s=createInitialState(),ids=s.units.map(u=>u.id);
  for(let i=0;i<3;i++){const r=expeditionOutcome(s,REGIONS[0],ids,fixed(.99,.99,.01,.5));assert.equal(r.ok,true)}
  assert.equal(s.warReady,true);assert.equal(s.pendingWarSeason,1);
  const blocked=expeditionOutcome(s,REGIONS[0],ids,fixed(.99));assert.equal(blocked.ok,false);
});

test("season war victory captures territory and clears the gate",()=>{
  const s=createInitialState();s.warReady=true;s.pendingWarSeason=1;s.rivals.arcane.armyPower=20;
  const before=s.rivals.arcane.territory,r=resolveSeasonWar(s,"arcane",s.units.map(u=>u.id),fixed(.99,.01),false);
  assert.equal(r.win,true);assert.equal(s.warReady,false);assert.ok(s.rivals.arcane.territory<before);
});

test("season war defeat is recoverable",()=>{
  const s=createInitialState();s.warReady=true;s.rivals.demon.armyPower=9999;const gold=s.resources.gold;
  const r=resolveSeasonWar(s,"demon",s.units.map(u=>u.id),fixed(.01,.99),false);
  assert.equal(r.win,false);assert.equal(s.gameOver,false);assert.ok(s.resources.gold<gold);assert.equal(s.warReady,false);
});

test("capital unlock requires campaign and city progress",()=>{
  const s=createInitialState();s.buildings.townhall=3;s.rivals.arcane.warWins=2;s.rivals.arcane.territory=1;s.units.forEach(u=>u.level=10);
  updateCapitalLocks(s);assert.equal(s.rivals.arcane.capitalUnlocked,true);
});

test("both capital victories trigger campaign victory",()=>{
  const s=createInitialState();s.buildings.townhall=4;s.units.forEach(u=>u.level=12);
  for(const k of ["arcane","demon"]){s.rivals[k].capitalUnlocked=true;s.rivals[k].armyPower=20;s.rivals[k].territory=1;s.warReady=true;const r=resolveSeasonWar(s,k,s.units.map(u=>u.id),fixed(.99,.01),true);assert.equal(r.win,true)}
  assert.equal(s.victory,true);assert.equal(s.gameOver,true);
});

test("calendar helper does not advance while war is pending",()=>{
  const s=createInitialState();s.warReady=true;const month=s.month;const r=advanceMonth(s);assert.equal(r.blocked,true);assert.equal(s.month,month);
});
