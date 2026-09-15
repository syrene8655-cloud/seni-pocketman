'use strict';
const plasticPalette=Object.freeze([
 {id:'amber',name:'琥珀橙',color:'#d98535',hue:28,shellFilter:'hue-rotate(185deg) saturate(1.8) brightness(1.45)'},
 {id:'smoke',name:'烟灰',color:'#687276',hue:null,shellFilter:'grayscale(1) brightness(1.45)'},
 {id:'forest',name:'墨绿',color:'#356955',hue:155,shellFilter:'hue-rotate(-65deg) saturate(1.1) brightness(1.3)'},
 {id:'wine',name:'酒红',color:'#843f57',hue:345,shellFilter:'hue-rotate(145deg) saturate(1.6) brightness(1.25)'},
 {id:'ocean',name:'海蓝',color:'#326d91',hue:210,shellFilter:'saturate(1.3) brightness(1.35)'},
 {id:'violet',name:'葡萄紫',color:'#795397',hue:280,shellFilter:'hue-rotate(75deg) saturate(1.3) brightness(1.35)'}
].map(Object.freeze));
// Classify colour families, including neutral areas. HSL hue centres alone put
// olive greens nearer amber; raw RGB chroma also lets lit skin outweigh dark blue.
function plasticFromPixels(data){
 const scores=new Map(plasticPalette.map(p=>[p.id,0]));
 for(let i=0;i+3<data.length;i+=4){
  const alpha=data[i+3]/255;if(alpha<.15)continue;
  const r=data[i]/255,g=data[i+1]/255,b=data[i+2]/255,max=Math.max(r,g,b),min=Math.min(r,g,b),chroma=max-min,light=(max+min)/2;
  const saturation=chroma?chroma/(1-Math.abs(2*light-1)):0;
  if(light<.035||light>.97||chroma<.07||saturation<.2){scores.set('smoke',scores.get('smoke')+alpha*.25);continue}
  let hue=max===r?((g-b)/chroma)%6:max===g?(b-r)/chroma+2:(r-g)/chroma+4;hue=(hue*60+360)%360;
  const family=hue<12||hue>=325?'wine':hue<70?'amber':hue<180?'forest':hue<255?'ocean':'violet';
  const weight=alpha*saturation*saturation*Math.min(1,chroma/.12)*(.6+.4*Math.sin(Math.PI*light));
  scores.set(family,scores.get(family)+weight);
 }
 return plasticPalette.reduce((best,p)=>scores.get(p.id)>scores.get(best.id)?p:best,plasticPalette[1]);
}
function plasticFromImage(img){
 try{const canvas=document.createElement('canvas');canvas.width=canvas.height=32;const context=canvas.getContext('2d',{willReadFrequently:true});context.drawImage(img,0,0,32,32);return plasticFromPixels(context.getImageData(0,0,32,32).data)}catch{return plasticPalette[1]}
}
