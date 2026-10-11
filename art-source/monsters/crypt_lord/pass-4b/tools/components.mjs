// Pose isolation without merging overlapping bounding rectangles. Alpha-connected pixels stay together.
import { readAnyPng } from '../../../crypt_brute/pass-4b/tools/png.mjs';
export function components(img, threshold = 12) {
  const {width: w, height: h, data} = img, labels = new Int32Array(w*h), regions = [];
  for(let p=0;p<labels.length;p++) {
    if(labels[p] || data[p*4+3] < threshold) continue;
    const id=regions.length+1, stack=[p], box=[w,h,0,0]; let n=0;
    labels[p]=id;
    while(stack.length) {
      const v=stack.pop(), x=v%w, y=Math.floor(v/w); n++;
      box[0]=Math.min(box[0],x); box[1]=Math.min(box[1],y); box[2]=Math.max(box[2],x); box[3]=Math.max(box[3],y);
      for(let dy=-1;dy<=1;dy++) for(let dx=-1;dx<=1;dx++) {
        const xx=x+dx, yy=y+dy; if(xx<0||yy<0||xx>=w||yy>=h) continue;
        const q=yy*w+xx; if(!labels[q] && data[q*4+3]>=threshold) {labels[q]=id;stack.push(q);}
      }
    }
    regions.push({id,box,n});
  }
  return {labels,regions};
}
if(process.argv[1]?.endsWith('components.mjs')) {
  const img=readAnyPng(process.argv[2]); console.log(JSON.stringify({size:[img.width,img.height],regions:components(img).regions.filter(r=>r.n>500)},null,2));
}
