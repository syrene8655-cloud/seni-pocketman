'use strict';
// CSS background-size:cover must not upscale either cropped image dimension.
function cassetteCoverMode(info,width,height,pixelRatio=1){
 if(!info||!info.valid||!info.width||!info.height)return 'paper';
 const demand=Math.max(width/info.width,height/info.height)*Math.max(1,pixelRatio);
 return demand<=1?'full':'tinted';
}

// Prefer the ink whose lower-quartile contrast survives a busy printed image.
function cassetteInkFromPixels(data){
 const luminances=[];
 const linear=v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4};
 for(let i=0;i<data.length;i+=4){if(data[i+3]<128)continue;luminances.push(.2126*linear(data[i])+.7152*linear(data[i+1])+.0722*linear(data[i+2]))}
 if(!luminances.length)return '#ffffff';
 const score=white=>{const contrasts=luminances.map(l=>white?1.05/(l+.05):(l+.05)/(.005605391624202723+.05)).sort((a,b)=>a-b);return contrasts[Math.floor((contrasts.length-1)*.25)]};
 return score(true)>=score(false)?'#ffffff':'#111111';
}
function cassetteCoverInks(img){
 const fallback={top:'#ffffff',bottom:'#ffffff'};
 try{
  const width=414,height=167,canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
  const context=canvas.getContext('2d',{willReadFrequently:true}),scale=Math.max(width/img.naturalWidth,height/img.naturalHeight);
  context.drawImage(img,(width-img.naturalWidth*scale)/2,(height-img.naturalHeight*scale)/2,img.naturalWidth*scale,img.naturalHeight*scale);
  return {top:cassetteInkFromPixels(context.getImageData(25,8,364,34).data),bottom:cassetteInkFromPixels(context.getImageData(20,143,374,16).data)};
 }catch{return fallback}
}

const cassettePrintStyles=['retro','metal','studio'];
function cassettePrintStyle(identity){let hash=0;for(const char of identity)hash=(hash*31+char.codePointAt(0))>>>0;return cassettePrintStyles[hash%cassettePrintStyles.length]}

// Assign a permanent printed spine layout within this page; song data stays live.
const cassetteSpineStyles=['ivory','colour','editorial','split'];
function cassetteSpineStyle(identity){let hash=0;for(const char of identity)hash=(hash*31+char.codePointAt(0))>>>0;return cassetteSpineStyles[hash%cassetteSpineStyles.length]}

// Request a bounded JPEG from NetEase's image service before proxying it.
function neteaseArtwork(value){
 try{
  if(!String(value||'').startsWith('/api/netease/image?'))return value;
  const proxy=new URL(value,'https://walkman.invalid'),image=new URL(proxy.searchParams.get('url'));
  if(!['music.126.net','music.163.com'].some(d=>image.hostname===d||image.hostname.endsWith('.'+d)))return value;
  image.searchParams.set('param','1000y1000');image.searchParams.set('quality','80');
  return '/api/netease/image?url='+encodeURIComponent(image.href);
 }catch{return value}
}
