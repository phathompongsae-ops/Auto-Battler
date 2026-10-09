import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EventBus } from '../../src/core/EventBus';
import type { GameEvents } from '../../src/game/GameEvents';
import type { CombatWorld } from '../../src/game/CombatWorld';
import { MonsterMotion } from '../../src/rendering/MonsterMotion';

function rig() {
  const events = new EventBus<GameEvents>();
  let pose = [0,0,0];
  const actor = { id:'boss', x:100,y:100,visible:true,def:{scale:2.5},combat:{dead:false,hp:500},body:{velocity:{x:30,y:0}},
    setPose:(x:number,y:number,r:number)=>{pose=[x,y,r];} };
  const player={id:'player',x:130,y:100};
  let windup=false;
  const world={events,monsters:[actor],player,monsterById:(id:string)=>id===actor.id?actor:null,
    getEntity:(id:string)=>id===actor.id?actor:player,skills:{windingUp:()=>windup}};
  const motion=new MonsterMotion(world as unknown as CombatWorld);
  return {world,events,actor,motion,pose:()=>pose,windup:(v:boolean)=>{windup=v;}};
}
test('monster walk/windup/attack/recoil presentation stays bounded and never changes simulation state',()=>{
  const r=rig();
  const before=JSON.stringify({x:r.actor.x,y:r.actor.y,body:r.actor.body,hp:r.actor.combat.hp});
  for(let i=0;i<20;i++)r.motion.update(16);
  assert.ok(r.pose().some(v=>v!==0));
  r.windup(true); for(let i=0;i<20;i++)r.motion.update(16);
  assert.ok(Math.abs(r.pose()[2])<.15);
  r.events.emit('miss',{sourceId:'boss',targetId:'player',skillId:'basic_attack'});
  r.motion.update(80); assert.ok(r.pose()[0]>0 && r.pose()[0]<=7);
  r.events.emit('damage',{sourceId:'player',targetId:'boss',skillId:'basic_attack',amount:1,crit:false,heavy:false});
  r.motion.update(60); assert.ok(Math.abs(r.pose()[0])<=10);
  assert.equal(JSON.stringify({x:r.actor.x,y:r.actor.y,body:r.actor.body,hp:r.actor.combat.hp}),before);
});
test('map changes, respawns and replacement actors clear stale visual attack state; idle settles',()=>{
  const r=rig();r.actor.body.velocity.x=0;
  r.events.emit('miss',{sourceId:'boss',targetId:'player',skillId:'basic_attack'});
  r.motion.update(40);assert.ok(r.pose()[0]>0);
  r.events.emit('respawn',{entityId:'boss'});r.motion.update(16);assert.deepEqual(r.pose(),[0,0,0]);
  r.events.emit('miss',{sourceId:'boss',targetId:'player',skillId:'basic_attack'});
  r.events.emit('mapChanged',{fromMapId:'a',toMapId:'b',portalId:'test'});r.motion.update(16);assert.deepEqual(r.pose(),[0,0,0]);
  r.world.monsters[0]={...r.actor};r.motion.update(16);assert.deepEqual(r.pose(),[0,0,0]);
});
