#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const baseSha = 'ca5d91972f9a26fea641f2f26b41312de5d2157b';
const expectedBranch = 'coco/arena-ruins-static-board-production-pack-v1';
const packPath = 'assets/maps/arena-ruins/board/arena-ruins-static-board-pack-v1.json';
const docPath = 'docs/assets/review/arena-ruins/production-pack-v1/ARENA_RUINS_STATIC_BOARD_PRODUCTION_PACK_V1.md';
const failures = [];

const expected = new Map([
  ['arenaRuins.boardSurface.v1', {path:'assets/maps/arena-ruins/board/arena-ruins-board-surface-v1.png', dimensions:[1024,896], colorType:2, alpha:false}],
  ['arenaRuins.borderCorners.v1', {path:'assets/maps/arena-ruins/board/arena-ruins-border-corners-v1.png', dimensions:[1024,1024], colorType:6, alpha:true, alphaRange:[0.30,0.36]}],
  ['arenaRuins.perimeterGround.v1', {path:'assets/maps/arena-ruins/board/arena-ruins-perimeter-ground-v1.png', dimensions:[512,512], colorType:2, alpha:false}],
  ['arenaRuins.backgroundModules.v1', {path:'assets/maps/arena-ruins/board/arena-ruins-background-modules-v1.png', dimensions:[1024,1024], colorType:6, alpha:true, alphaRange:[0.34,0.41]}],
  ['arenaRuins.benchTreatment.v1', {path:'assets/maps/arena-ruins/board/arena-ruins-bench-treatment-v1.png', dimensions:[1024,128], colorType:6, alpha:true, alphaRange:[0.83,0.89]}],
  ['arenaRuins.tileStates.v1', {path:'assets/maps/arena-ruins/board/arena-ruins-tile-states-v1.png', dimensions:[1024,768], colorType:6, alpha:true, alphaRange:[0.49,0.56]}],
  ['arenaRuins.props.v1', {path:'assets/maps/arena-ruins/board/arena-ruins-props-v1.png', dimensions:[1024,1024], colorType:6, alpha:true, alphaRange:[0.30,0.36]}],
]);

const expectedReview = new Map([
  ['docs/assets/review/arena-ruins/production-pack-v1/production-pack-contact-sheet.png',[992,1712]],
  ['docs/assets/review/arena-ruins/production-pack-v1/production-pack-composited-preview.png',[1536,1024]],
  ['docs/assets/review/arena-ruins/production-pack-v1/production-pack-with-pilots.png',[1536,1024]],
  ['docs/assets/review/arena-ruins/production-pack-v1/production-pack-mobile-preview.png',[844,390]],
]);

const pilotHashes = new Map([
  ['assets/units/hero.archer/idle/hero.archer_idle_000.png','4a1a24f9e691d48aeef55c235a47af07931032e6345b159122f0128d7aa7e888'],
  ['assets/units/monster.slime/move/monster.slime_move_000.png','12ca260a001dbda6177f29565e9df2c369c09216c889974aeee8b12fb5ae04f9'],
  ['assets/mon_golem.png','50a51034e08f7ca479a036bb17488c58192480204487bcded48d91838b0db42e'],
]);

const signature = Buffer.from([137,80,78,71,13,10,26,10]);
const crcTable = new Uint32Array(256);
for (let n=0;n<256;n+=1) { let c=n; for(let k=0;k<8;k+=1)c=(c&1)?(0xedb88320^(c>>>1)):(c>>>1); crcTable[n]=c>>>0; }
function crc32(buffer) { let crc=0xffffffff; for(const byte of buffer)crc=crcTable[(crc^byte)&0xff]^(crc>>>8); return (crc^0xffffffff)>>>0; }
function sha256(filePath) { return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex'); }
function paeth(a,b,c) { const p=a+b-c, pa=Math.abs(p-a), pb=Math.abs(p-b), pc=Math.abs(p-c); return pa<=pb&&pa<=pc?a:pb<=pc?b:c; }

function parsePng(relativePath, decodePixels=false) {
  const buffer=fs.readFileSync(path.join(root,relativePath));
  if(buffer.length<64||!buffer.subarray(0,8).equals(signature))throw new Error('invalid PNG signature/size');
  let offset=8,ihdr=null,sawIend=false,palette=null,trns=null;const idat=[];
  while(offset+12<=buffer.length){
    const length=buffer.readUInt32BE(offset),typeOffset=offset+4,dataOffset=offset+8,crcOffset=dataOffset+length;
    if(crcOffset+4>buffer.length)throw new Error('truncated chunk');
    const type=buffer.toString('ascii',typeOffset,dataOffset),typeData=buffer.subarray(typeOffset,crcOffset);
    if(crc32(typeData)!==buffer.readUInt32BE(crcOffset))throw new Error(`CRC mismatch ${type}`);
    const data=buffer.subarray(dataOffset,crcOffset);
    if(type==='IHDR')ihdr=Buffer.from(data); else if(type==='IDAT')idat.push(Buffer.from(data)); else if(type==='PLTE')palette=Buffer.from(data); else if(type==='tRNS')trns=Buffer.from(data);
    offset=crcOffset+4;
    if(type==='IEND'){sawIend=true;break;}
  }
  if(!ihdr||ihdr.length!==13||!sawIend||offset!==buffer.length||idat.length===0)throw new Error('invalid PNG chunk structure');
  const width=ihdr.readUInt32BE(0),height=ihdr.readUInt32BE(4),bitDepth=ihdr[8],colorType=ihdr[9],interlace=ihdr[12];
  if(bitDepth!==8||![2,3,6].includes(colorType)||interlace!==0)throw new Error(`unsupported mode depth=${bitDepth} type=${colorType} interlace=${interlace}`);
  const channels=colorType===6?4:colorType===2?3:1,rowBytes=width*channels,raw=zlib.inflateSync(Buffer.concat(idat));
  if(raw.length!==(rowBytes+1)*height)throw new Error(`decoded bytes ${raw.length} mismatch`);
  if(!decodePixels)return{width,height,bitDepth,colorType,bytes:buffer.length};
  const scan=Buffer.alloc(rowBytes*height); let src=0;
  for(let y=0;y<height;y+=1){
    const filter=raw[src++]; if(filter>4)throw new Error(`invalid filter ${filter}`);
    for(let x=0;x<rowBytes;x+=1){
      const value=raw[src++],left=x>=channels?scan[y*rowBytes+x-channels]:0,up=y?scan[(y-1)*rowBytes+x]:0,upLeft=(y&&x>=channels)?scan[(y-1)*rowBytes+x-channels]:0;
      const predictor=filter===0?0:filter===1?left:filter===2?up:filter===3?Math.floor((left+up)/2):paeth(left,up,upLeft);
      scan[y*rowBytes+x]=(value+predictor)&255;
    }
  }
  const rgba=Buffer.alloc(width*height*4);
  for(let i=0;i<width*height;i+=1){
    if(colorType===6){scan.copy(rgba,i*4,i*4,i*4+4);}
    else if(colorType===2){rgba[i*4]=scan[i*3];rgba[i*4+1]=scan[i*3+1];rgba[i*4+2]=scan[i*3+2];rgba[i*4+3]=255;}
    else {const idx=scan[i],p=idx*3;rgba[i*4]=palette?.[p]??0;rgba[i*4+1]=palette?.[p+1]??0;rgba[i*4+2]=palette?.[p+2]??0;rgba[i*4+3]=trns&&idx<trns.length?trns[idx]:255;}
  }
  return{width,height,bitDepth,colorType,bytes:buffer.length,rgba};
}

function pixel(info,x,y){const i=(y*info.width+x)*4;return info.rgba.subarray(i,i+4);}
function alphaAnalysis(info){
  let nonzero=0,nearWhiteNeutral=0,opaqueBorder=0;
  for(let y=0;y<info.height;y+=1)for(let x=0;x<info.width;x+=1){
    const [r,g,b,a]=pixel(info,x,y); if(a>0)nonzero+=1;
    if(a>16&&r>=238&&g>=238&&b>=238&&Math.max(r,g,b)-Math.min(r,g,b)<=10)nearWhiteNeutral+=1;
    if((x===0||y===0||x===info.width-1||y===info.height-1)&&a>0)opaqueBorder+=1;
  }
  return{nonzeroFraction:nonzero/(info.width*info.height),nearWhiteNeutral,opaqueBorder};
}

let pack=null;
try{pack=JSON.parse(fs.readFileSync(path.join(root,packPath),'utf8'));}catch(error){failures.push(`${packPath}: ${error.message}`);}
if(pack){
  if(pack.canonicalApproved!==false||pack.runtimeIntegrated!==false)failures.push('pack approval/runtime state mismatch');
  if(pack.status!=='asset-source-ready-for-separate-cc-integration')failures.push('pack status mismatch');
  if(pack.base?.sha!==baseSha)failures.push('pack base SHA mismatch');
  if(pack.assets?.length!==7)failures.push('pack must list seven assets');
  if(pack.memory?.decodedRgba8Bytes!==20971520||pack.memory?.actualPngBytes!==3080259)failures.push('pack memory/byte totals mismatch');
}

const seenHashes=new Set(); let actualTotal=0;
for(const asset of pack?.assets||[]){
  const spec=expected.get(asset.assetId); if(!spec){failures.push(`unexpected asset ${asset.assetId}`);continue;}
  if(asset.path!==spec.path||!fs.existsSync(path.join(root,spec.path))){failures.push(`${asset.assetId}: path missing/mismatch`);continue;}
  try{
    const info=parsePng(spec.path,true); actualTotal+=info.bytes;
    if(info.width!==spec.dimensions[0]||info.height!==spec.dimensions[1])failures.push(`${spec.path}: dimensions mismatch`);
    if(info.colorType!==spec.colorType)failures.push(`${spec.path}: expected PNG color type ${spec.colorType}, got ${info.colorType}`);
    if(asset.bytes!==info.bytes)failures.push(`${spec.path}: manifest byte count mismatch`);
    const hash=sha256(path.join(root,spec.path)); if(hash!==asset.sha256)failures.push(`${spec.path}: manifest hash mismatch`);
    if(seenHashes.has(hash))failures.push(`${spec.path}: duplicate production hash`); seenHashes.add(hash);
    if(asset.canonicalApproved!==false||asset.pilotEmbedded!==false||asset.uiEmbedded!==false||asset.gameplayStateEmbedded!==false)failures.push(`${spec.path}: forbidden embedded/approval flag`);
    if(spec.alpha){
      const analysis=alphaAnalysis(info);
      if(analysis.opaqueBorder!==0)failures.push(`${spec.path}: ${analysis.opaqueBorder} nontransparent border pixels`);
      for(const [x,y] of [[0,0],[info.width-1,0],[0,info.height-1],[info.width-1,info.height-1]])if(pixel(info,x,y)[3]!==0)failures.push(`${spec.path}: corner alpha not zero`);
      if(analysis.nonzeroFraction<spec.alphaRange[0]||analysis.nonzeroFraction>spec.alphaRange[1])failures.push(`${spec.path}: alpha fraction ${analysis.nonzeroFraction.toFixed(6)} outside range`);
      if(analysis.nearWhiteNeutral>10)failures.push(`${spec.path}: possible checker/light-background residue pixels=${analysis.nearWhiteNeutral}`);
      if(Math.abs(analysis.nonzeroFraction-asset.alphaNonZeroFraction)>0.00001)failures.push(`${spec.path}: alpha fraction metadata mismatch ${analysis.nonzeroFraction}`);
      console.log(`ALPHA OK ${path.basename(spec.path)} nonzero=${analysis.nonzeroFraction.toFixed(6)} border=0 checkerCandidates=${analysis.nearWhiteNeutral}`);
    }
    console.log(`PNG OK ${path.basename(spec.path)} ${info.width}x${info.height} type=${info.colorType} bytes=${info.bytes} sha256=${hash}`);
  }catch(error){failures.push(`${spec.path}: ${error.message}`);}
}
if(actualTotal!==3080259)failures.push(`actual production PNG total ${actualTotal} != 3080259`);

if(seenHashes.size!==7)failures.push(`expected seven unique hashes, got ${seenHashes.size}`);
for(const id of expected.keys())if(!(pack?.assets||[]).some((asset)=>asset.assetId===id))failures.push(`missing assetId ${id}`);

try{
  const perimeter=parsePng(expected.get('arenaRuins.perimeterGround.v1').path,true);let lr=0,tb=0;
  for(let y=0;y<perimeter.height;y+=1)if(!pixel(perimeter,0,y).equals(pixel(perimeter,perimeter.width-1,y)))lr+=1;
  for(let x=0;x<perimeter.width;x+=1)if(!pixel(perimeter,x,0).equals(pixel(perimeter,x,perimeter.height-1)))tb+=1;
  if(lr||tb)failures.push(`perimeter seam mismatch leftRight=${lr} topBottom=${tb}`);
  else console.log('SEAM OK perimeter leftRight=0 topBottom=0');
}catch(error){failures.push(`perimeter seam test: ${error.message}`);}

try{
  const states=parsePng(expected.get('arenaRuins.tileStates.v1').path,true);let unusedOpaque=0;
  for(let y=512;y<768;y+=1)for(let x=256;x<1024;x+=1)if(pixel(states,x,y)[3]!==0)unusedOpaque+=1;
  if(unusedOpaque!==0)failures.push(`tile states unused cells have ${unusedOpaque} nontransparent pixels`);
  else console.log('ATLAS OK tile-state unused cells 9-11 fully transparent');
}catch(error){failures.push(`tile-state atlas test: ${error.message}`);}

try{
  const board=parsePng(expected.get('arenaRuins.boardSurface.v1').path,true);
  const lum=(p)=>0.2126*p[0]+0.7152*p[1]+0.0722*p[2]; let seamSum=0,seamN=0,centerSum=0,centerN=0;
  for(let y=0;y<board.height;y+=1)for(const x of [128,256,384,512,640,768,896])for(let dx=-2;dx<=2;dx+=1){seamSum+=lum(pixel(board,x+dx,y));seamN+=1;}
  for(let x=0;x<board.width;x+=1)for(const y of [128,256,384,512,640,768])for(let dy=-2;dy<=2;dy+=1){seamSum+=lum(pixel(board,x,y+dy));seamN+=1;}
  for(const cy of [64,192,320,448,576,704,832])for(const cx of [64,192,320,448,576,704,832,960]){centerSum+=lum(pixel(board,cx,cy));centerN+=1;}
  const seamMean=seamSum/seamN,centerMean=centerSum/centerN;
  if(!(seamMean<centerMean-3))failures.push(`board grid contrast weak seam=${seamMean.toFixed(2)} center=${centerMean.toFixed(2)}`);
  else console.log(`GRID OK 8x7 seamLuma=${seamMean.toFixed(2)} centerLuma=${centerMean.toFixed(2)}`);
}catch(error){failures.push(`board grid test: ${error.message}`);}

for(const [reviewPath,dimensions] of expectedReview){
  if(!fs.existsSync(path.join(root,reviewPath))){failures.push(`missing review artifact ${reviewPath}`);continue;}
  try{const info=parsePng(reviewPath,false);if(info.width!==dimensions[0]||info.height!==dimensions[1])failures.push(`${reviewPath}: dimensions mismatch`);console.log(`REVIEW OK ${path.basename(reviewPath)} ${info.width}x${info.height}`);}catch(error){failures.push(`${reviewPath}: ${error.message}`);}
}

for(const [pilotPath,expectedHash] of pilotHashes){const actual=sha256(path.join(root,pilotPath));if(actual!==expectedHash)failures.push(`${pilotPath}: source hash changed`);else console.log(`PILOT SOURCE OK ${pilotPath} ${actual}`);}

const doc=fs.existsSync(path.join(root,docPath))?fs.readFileSync(path.join(root,docPath),'utf8'):'';
for(const fragment of ['# Arena Ruins Static Board Production Pack v1','asset-source ready for separate CC integration','Production files','Alpha, border and checkerboard findings','Pilot and mobile review','canonicalApproved=false'])if(!doc.includes(fragment))failures.push(`${docPath}: missing ${fragment}`);
if(doc.includes('canonicalApproved=true'))failures.push(`${docPath}: canonicalApproved=true forbidden`);

try{const branch=execFileSync('git',['branch','--show-current'],{cwd:root,encoding:'utf8'}).trim();if(branch!==expectedBranch)failures.push(`unexpected branch ${branch}`);execFileSync('git',['cat-file','-e',`${baseSha}^{commit}`],{cwd:root});console.log(`BRANCH OK ${branch}`);console.log(`BASE OK ${baseSha}`);}catch(error){failures.push(`branch/base: ${error.message}`);}

let status='';try{status=execFileSync('git',['status','--porcelain=v1','--untracked-files=all'],{cwd:root,encoding:'utf8'});}catch(error){failures.push(`git status: ${error.message}`);}
const allowedPrefixes=['assets/maps/arena-ruins/board/','docs/assets/review/arena-ruins/production-pack-v1/'];
for(const line of status.trim().split('\n').filter(Boolean)){
  const relative=line.slice(3).replace(/^"|"$/g,'');
  const allowed=allowedPrefixes.some((prefix)=>relative.startsWith(prefix))||relative==='tools/validate-arena-ruins-static-board-production-pack-v1.mjs';
  if(!allowed)failures.push(`scope violation ${relative}`); if(line.startsWith(' D')||line.startsWith('D '))failures.push(`deletion forbidden ${relative}`);
}

if(failures.length){console.error('\nArena Ruins Static Board Production Pack v1 validation FAILED');for(const failure of failures)console.error(`- ${failure}`);process.exit(1);}
console.log(`PACK OK assets=7 uniqueHashes=7 actualPngBytes=${actualTotal}`);
console.log('STATUS asset-source ready for separate CC integration; runtimeIntegrated=false');
console.log('Arena Ruins Static Board Production Pack v1 validation PASSED');
console.log('canonicalApproved=false');
