import test from "node:test";
import assert from "node:assert/strict";
import {createInitialState,upgradeBuilding,recruit,REGIONS,expeditionOutcome,resolveSeasonWar,armyPower} from "../src/fantasy-core.js";

const fixed=(...vals)=>{let i=0;return()=>vals[i++%vals.length]};

test("initial state is playable",()=>{
  const s=createInitialState();
  assert.equal(s.buildings.townhall,1);
  assert.ok(s.resources.gold>=200);
  assert.ok(s.units.length>=4);
  assert.ok(armyPower(s)>0);
});

test("building upgrade spends resources",()=>{
  const s=createInitialState(); const before=s.resources.wood;
  const r=upgradeBuilding(s,"house");
  assert.equal(r.ok,true); assert.equal(s.buildings.house,2); assert.ok(s.resources.wood<before);
});

test("recruitment works and respects resources",()=>{
  const s=createInitialState();const before=s.units.length;
  const r=recruit(s,"Warrior");
  assert.equal(r.ok,true);assert.equal(s.units.length,before+1);
});

test("expedition resolves and advances month",()=>{
  const s=createInitialState();const ids=s.units.slice(0,4).map(u=>u.id);
  const r=expeditionOutcome(s,REGIONS[0],ids,fixed(.99,.01,.5));
  assert.equal(r.ok,true);assert.equal(s.month,2);assert.equal(s.stats.expeditions,1);
});

test("season war can capture territory",()=>{
  const s=createInitialState();
  s.warReady=true;s.rivals.arcane.armyPower=20;
  const ids=s.units.slice(0,4).map(u=>u.id),before=s.rivals.arcane.territory;
  const r=resolveSeasonWar(s,"arcane",ids,fixed(.99,.01),false);
  assert.equal(r.ok,true);assert.equal(r.win,true);assert.equal(s.warReady,false);assert.ok(s.rivals.arcane.territory<=before);
});

test("both capital victories trigger campaign victory",()=>{
  const s=createInitialState();s.buildings.townhall=4;
  s.units.forEach(u=>u.level=10);
  for(const k of ["arcane","demon"]){s.rivals[k].capitalUnlocked=true;s.rivals[k].armyPower=20;s.rivals[k].territory=1;s.warReady=true;const r=resolveSeasonWar(s,k,s.units.map(u=>u.id),fixed(.99,.01),true);assert.equal(r.win,true)}
  assert.equal(s.victory,true);assert.equal(s.gameOver,true);
});
