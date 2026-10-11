// Disposable review sheets; world-scale hierarchy uses the actual runtime draw scale, 0.5.
import { mkdirSync, writeFileSync } from 'node:fs';
import { readAnyPng, encodePng } from '../../../crypt_brute/pass-4b/tools/png.mjs';
const base='art-source/monsters/crypt_lord/pass-4b/fit/', dest='test-results/lord-art-review'; mkdirSync(dest,{recursive:true});
function canvas(w,h) {const data=new Uint8Array(w*h*4);for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=(y*w+x)*4,v=(Math.floor(x/12)+Math.floor(y/12))%2?64:82;data.set([v,v,v,255],i);}return {width:w,height:h,data};}
function paint(out,img,sx,sy,sw,sh,dx,dy,scale=1) {for(let y=0;y<Math.ceil(sh*scale);y++)for(let x=0;x<Math.ceil(sw*scale);x++){const xx=dx+x,yy=dy+y;if(xx<0||yy<0||xx>=out.width||yy>=out.height)continue;const a=(Math.min(img.height-1,sy+Math.floor(y/scale))*img.width+Math.min(img.width-1,sx+Math.floor(x/scale)))*4,o=(yy*out.width+xx)*4,al=img.data[a+3]/255;for(let c=0;c<3;c++)out.data[o+c]=Math.round(img.data[a+c]*al+out.data[o+c]*(1-al));}}
const states=['idle','walk','attack','special','hit'], full=canvas(1120,5*208);
states.forEach((s,row)=>{const img=readAnyPng(base+s+'.png'),n=img.width/224,sheet=canvas(1120,Math.ceil(n/5)*208);for(let f=0;f<n;f++){paint(sheet,img,f*224,0,224,192,(f%5)*224,Math.floor(f/5)*208);paint(full,img,f*224,0,224,192,f*112,row*208,0.5);}writeFileSync(dest+'/'+s+'.png',encodePng(sheet.width,sheet.height,sheet.data));});
writeFileSync(dest+'/all-states.png',encodePng(full.width,full.height,full.data));
const lineup=canvas(520,130),entries=[['public/assets/monsters/crypt_skeleton.png',70,84,81],['public/assets/monsters/crypt_brute/idle.png',176,144,142],['public/assets/monsters/crypt_knight.png',120,108,106],[base+'idle.png',224,192,190]];
entries.forEach(([p,w,h,feet],n)=>paint(lineup,readAnyPng(p),0,0,w,h,Math.round(65+n*130-w/4),Math.round(110-feet/2),0.5));
for(let x=0;x<lineup.width;x++)lineup.data.set([100,190,110,255],(110*lineup.width+x)*4);
writeFileSync(dest+'/hierarchy.png',encodePng(lineup.width,lineup.height,lineup.data));
console.log(dest);
