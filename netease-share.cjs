'use strict';
const invalid=message=>Object.assign(new Error(message),{status:400});
const hosts=new Set(['music.163.com','y.music.163.com','163cn.tv']);
function shareURL(value){
 let u;try{u=new URL(value)}catch{throw invalid('请粘贴网易云歌单分享内容或歌单编号。')}
 if(!['https:','http:'].includes(u.protocol)||!hosts.has(u.hostname)||u.username||u.password||u.port)throw invalid('请使用网易云音乐的歌单分享链接。');
 u.protocol='https:';return u;
}
function playlistID(u){
 if(u.hostname==='163cn.tv')return null;
 const hash=u.hash.slice(1),route=hash.startsWith('/')?new URL(hash,u.origin):u;
 if(!/^\/(?:m\/)?playlist(?:\/|$)/.test(route.pathname))throw invalid('这不是歌单链接，请在网易云歌单页面选择分享。');
 const id=route.searchParams.get('id')||route.pathname.match(/\/playlist\/(\d+)\/?$/)?.[1];
 if(!/^[1-9]\d{0,17}$/.test(id||''))throw invalid('链接中没有有效的歌单编号。');
 return id;
}
async function resolvePlaylistShare(value,{fetchImpl=fetch}={}){
 if(typeof value!=='string'||value.length>2000)throw invalid('分享内容过长，请只粘贴歌单链接。');
 const text=value.trim();if(/^[1-9]\d{0,17}$/.test(text))return text;
 const links=(text.match(/https?:\/\/[^\s<>"'，。；！）】]+/gi)||[]).map(s=>s.replace(/[),.;!]+$/,''));
 if(links.length!==1)throw invalid('请一次粘贴一个网易云歌单分享链接，或直接输入歌单编号。');
 let u=shareURL(links[0]);const signal=AbortSignal.timeout(8000);
 for(let hop=0;hop<4;hop++){
  const id=playlistID(u);if(id)return id;
  if(!/^\/[A-Za-z0-9_-]{1,80}\/?$/.test(u.pathname))throw invalid('手机分享链接格式无效，请重新复制。');
  let response;try{response=await fetchImpl(u.href,{method:'HEAD',redirect:'manual',signal})}catch{throw invalid('手机短链接暂时无法展开，请在浏览器打开后复制歌单完整链接。')}
  const location=response.headers.get('location');await response.body?.cancel();
  if(![301,302,303,307,308].includes(response.status)||!location)throw invalid('手机短链接可能已失效，请重新分享，或在浏览器打开后复制歌单完整链接。');
  u=shareURL(new URL(location,u).href);
 }
 throw invalid('手机短链接跳转过多，请在浏览器打开后复制歌单完整链接。');
}
module.exports={resolvePlaylistShare};
