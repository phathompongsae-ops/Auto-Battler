import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {TOWN_GROUND_WANG,TOWN_GROUND_WANG_PLAIN} from '../../src/data/environment/townGroundWang';

test('retained Field builder reads approved Town frame metadata without regenerating art',()=>{
  const builder=readFileSync('tools/env-art/buildFieldGround.mjs','utf8');
  const metadata=readFileSync('src/data/environment/townGroundWang.ts','utf8');
  const declarations=builder.split('\n').filter(line=>line.startsWith('const pairFrames =') || line.startsWith('const plainFrame =')).join('\n');
  const helpers=new Function('townTs',declarations+'; return {pairFrames,plainFrame};')(metadata);
  assert.deepEqual(helpers.pairFrames('dirt|grass'),TOWN_GROUND_WANG['dirt|grass']);
  assert.equal(helpers.plainFrame('grass'),TOWN_GROUND_WANG_PLAIN.grass[0]);
  assert.equal(helpers.plainFrame('dirt'),TOWN_GROUND_WANG_PLAIN.dirt[0]);
});
