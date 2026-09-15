'use strict';
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const {fork}=require('node:child_process'),{randomBytes}=require('node:crypto');
const root=__dirname;
const {developerToken,appleImageURL}=require('./apple-music.cjs');
const {serverPolicy}=require('./server-policy.cjs');
const {resolvePlaylistShare}=require('./netease-share.cjs');
function createUpstream(){
 let worker,seq=0;const pending=new Map();
 function stop(){worker?.kill();worker=null;for(const p of pending.values()){clearTimeout(p.timer);p.reject(new Error('音乐服务已重启，请重试。'))}pending.clear()}
 return {close:stop,call(method,params){
  if(pending.size>=64)return Promise.reject(Object.assign(new Error('音乐请求较多，请稍后重试。'),{status:429}));
  if(!worker){worker=fork(path.join(root,'netease-worker.cjs'),[],{stdio:['ignore','ignore','ignore','ipc']});
   worker.on('message',m=>{const p=pending.get(m.id);if(!p)return;clearTimeout(p.timer);pending.delete(m.id);m.error?p.reject(Object.assign(new Error(m.error.message),{status:[301,401].includes(m.error.code)?401:502})):p.resolve(m.result)});
   worker.on('exit',()=>{worker=null;stop()});worker.on('error',stop);
  }
  return new Promise((resolve,reject)=>{const id=++seq;const timer=setTimeout(()=>{pending.delete(id);reject(new Error('网易云响应超时，请重试。'))},20000);pending.set(id,{resolve,reject,timer});worker.send({id,method,params})});
 }};
}
const idValue=v=>{if(!/^[1-9]\d{0,17}$/.test(String(v)))throw Object.assign(new Error('请输入有效的歌曲或歌单编号。'),{status:400});return String(v)};
const offsetValue=v=>{const n=Number(v||0);if(!Number.isSafeInteger(n)||n<0||n>100000)throw Object.assign(new Error('分页参数无效。'),{status:400});return n};
function cdnURL(value,kind){try{const u=new URL(value);if(!['http:','https:'].includes(u.protocol)||u.port||u.username||u.password)return null;const domains=kind==='image'?['music.126.net','music.163.com']:['music.126.net','music.163.com'];if(!domains.some(d=>u.hostname===d||u.hostname.endsWith('.'+d)))return null;u.protocol='https:';return u.href}catch{return null}}
function createServer(upstream=createUpstream(),options={}){
 const policy=serverPolicy(options);
 const sessions=new Map();
 const clean=setInterval(()=>{for(const [k,s] of sessions)if(Date.now()-s.seen>12*3600000)sessions.delete(k)},60000);clean.unref();
 function merge(s,cookies=[]){for(const item of cookies){const pair=item.split(';',1)[0],at=pair.indexOf('=');if(at>0)s.cookie[pair.slice(0,at)]=pair.slice(at+1)}}
 async function call(s,method,params={}){const epoch=s.epoch;const r=await upstream.call(method,{...params,cookie:{...s.cookie}});if(epoch!==s.epoch)throw new Error('登录状态已变化，请重试。');merge(s,r.cookie);return r.body}
 function imageURL(value){const src=cdnURL(value,'image');return src?'/api/netease/image?url='+encodeURIComponent(src):'assets/cover-unavailable.svg'}
 function song(t){return {provider:'netease',id:String(t.id),title:t.name||'未命名曲目',artist:(t.ar||t.artists||[]).map(a=>a.name).filter(Boolean).join(' / '),album:(t.al||t.album)?.name||'',cover:imageURL((t.al||t.album)?.picUrl),duration:(t.dt||t.duration||0)/1000,variant:'sunset',description:'网易云音乐',src:''}}
 function json(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data))}
 const server=http.createServer(async(req,res)=>{
  const host=req.headers.host;
  const origin=policy.origin(req);
  if(!origin){res.writeHead(403);res.end();return}
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options','DENY');
  if(policy.publicURL)res.setHeader('Strict-Transport-Security','max-age=31536000');
  try{
   const u=new URL(req.url,origin);
   if(u.pathname==='/healthz'&&['GET','HEAD'].includes(req.method))return json(res,200,{ok:true,version:require('./package.json').version});
   if(u.pathname.startsWith('/api/')){
    if(req.headers.origin&&req.headers.origin!==origin||req.headers['sec-fetch-site']==='cross-site')return json(res,403,{error:'仅允许播放器页面访问。'});
    if(!policy.admit(req)){res.setHeader('Retry-After','60');return json(res,429,{error:'请求较多，请稍后再试。'})}
    let released=false;const release=()=>{if(!released){released=true;policy.release()}};res.once('close',release);res.once('finish',release);
    if(u.pathname==='/api/apple-music/token'){
     if(req.method!=='POST'||req.headers['x-cassette-client']!=='1')return json(res,403,{error:'请求来源无效。'});
     return json(res,200,developerToken(origin,options.musicKitConfig));
    }
    if(u.pathname==='/api/netease/image'||u.pathname==='/api/apple-music/image'){
     if(req.method!=='GET')return json(res,405,{error:'请求方式无效。'});
     const src=u.pathname==='/api/apple-music/image'?appleImageURL(u.searchParams.get('url')):cdnURL(u.searchParams.get('url'),'image');if(!src)return json(res,400,{error:'封面地址无效。'});
     const r=await fetch(src,{signal:AbortSignal.timeout(15000),redirect:'error'});const type=r.headers.get('content-type')||'';
     if(!r.ok||!/^image\/(jpeg|jpg|png|webp|gif)/.test(type))return json(res,502,{error:'封面暂时无法读取。'});
     const chunks=[];let length=0;for await(const part of r.body){length+=part.length;if(length>12*1024*1024)throw new Error('封面过大。');chunks.push(part)}
     res.writeHead(200,{'Content-Type':type,'Cache-Control':'private, max-age=3600'});res.end(Buffer.concat(chunks));return;
    }
    if(req.method!=='POST'||req.headers['x-cassette-client']!=='1')return json(res,403,{error:'请求来源无效。'});
    let raw='';for await(const part of req){raw+=part;if(raw.length>16384)return json(res,413,{error:'请求过大。'})}
    let p;try{p=JSON.parse(raw||'{}')}catch{return json(res,400,{error:'请求格式无效。'})}
    if(!p||typeof p!=='object'||Array.isArray(p))return json(res,400,{error:'请求格式无效。'});
    const route=u.pathname.replace('/api/netease/','');
    if(!['status','qr','qr-check','daily','likes','like','logout','playlists','playlist','search','stream','resolve-playlist'].includes(route))return json(res,404,{error:'接口不存在。'});
    if(route==='resolve-playlist')return json(res,200,{id:await resolvePlaylistShare(p.value,{fetchImpl:options.shareFetch||fetch})});
    // Cookies share a hostname across ports. Isolate local preview servers so
    // their anonymous sessions cannot overwrite the signed-in player session.
    const cookieName=policy.publicURL?'__Host-cassette_session':'cassette_session_'+host.split(':')[1];
    let token=(req.headers.cookie||'').split(/;\s*/).find(v=>v.startsWith(cookieName+'='))?.split('=')[1],s=sessions.get(token);
    if(!s){if(sessions.size>=(policy.publicURL?1000:100))return json(res,503,{error:'请稍后重试。'});token=randomBytes(32).toString('hex');s={cookie:{},seen:Date.now(),profile:null,qr:null,epoch:0};sessions.set(token,s);res.setHeader('Set-Cookie',`${cookieName}=${token}; HttpOnly; SameSite=Strict; Path=/${policy.publicURL?'; Secure':''}`)}s.seen=Date.now();
    let data;
    if(route==='status'){
     if(!s.profile)data={profile:null};else{const r=await call(s,'login_status');s.profile=r?.data?.profile||null;data={profile:s.profile?{nickname:s.profile.nickname}:null}}
    }else if(route==='qr'){
     const epoch=++s.epoch;s.qr=null;const r=await call(s,'login_qr_key');const key=r?.data?.unikey;if(!key)throw new Error('二维码生成失败，请重试。');
     const qr=await call(s,'login_qr_create',{key,qrimg:true});if(epoch!==s.epoch)throw new Error('二维码已更新。');s.qr={key,created:Date.now()};data={image:qr.data.qrimg};
    }else if(route==='qr-check'){
     const qr=s.qr,epoch=s.epoch;if(!qr||Date.now()-qr.created>180000)data={code:800};else{
      const r=await upstream.call('login_qr_check',{key:qr.key,cookie:{...s.cookie},timeout:15000});
      if(epoch!==s.epoch||s.qr!==qr)data={code:800};else{const code=r.body?.code;data={code};if(code===803){merge(s,r.cookie);const status=await call(s,'login_status');if(epoch!==s.epoch)throw new Error('登录已取消。');s.profile=status?.data?.profile||null;s.qr=null;if(!s.profile)throw new Error('登录状态未确认，请重新扫码。');data.profile={nickname:s.profile.nickname}}else if(code===800)s.qr=null;else if(![801,802].includes(code))throw new Error('扫码暂未成功，请刷新二维码重试。')}
     }
    }else if(route==='daily'){
     if(!s.profile)return json(res,401,{error:'请先扫码登录，再查看你的每日推荐。'});
     const r=await call(s,'recommend_songs'),items=r.data?.dailySongs||r.recommend;
     if(!Array.isArray(items))throw new Error('每日推荐暂时无法读取，请稍后重试。');
     data={name:'每日推荐',date:new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',month:'long',day:'numeric'}).format(new Date()),items:items.map(song),total:items.length,more:false};
    }else if(route==='likes'){
     if(!s.profile)return json(res,401,{error:'请先登录网易云，再同步喜欢状态。'});
     const r=await call(s,'likelist',{uid:s.profile.userId});
     if(r.code!==200||!Array.isArray(r.ids))throw new Error('喜欢列表读取失败，请重试。');
     data={ids:r.ids.map(String)};
    }else if(route==='like'){
     if(!s.profile)return json(res,401,{error:'请先登录网易云，再喜欢这首歌。'});
     const id=idValue(p.id);if(typeof p.like!=='boolean')return json(res,400,{error:'喜欢状态无效。'});
     if(s.preferenceBusy)return json(res,409,{error:'上一笔操作仍在同步，请稍后重试。'});
     s.preferenceBusy=true;
     try{const r=await call(s,'like',{id,like:String(p.like)});if(r.code!==200)throw new Error('网易云未确认喜欢状态，请刷新后重试。');data={id,liked:p.like}}finally{s.preferenceBusy=false}
    }else if(route==='logout'){s.epoch++;s.cookie={};s.profile=null;s.qr=null;data={ok:true};
    }else if(route==='playlists'){
     if(!s.profile)return json(res,401,{error:'请先扫码登录，再读取你的歌单。'});
     const offset=offsetValue(p.offset),r=await call(s,'user_playlist',{uid:s.profile.userId,limit:30,offset});data={items:(r.playlist||[]).filter(t=>String(t.creator?.userId)===String(s.profile.userId)).map(t=>({id:String(t.id),name:t.name,count:t.trackCount,cover:imageURL(t.coverImgUrl)})),more:!!r.more};
    }else if(route==='playlist'){
     const id=idValue(p.id),offset=offsetValue(p.offset),r=await call(s,'playlist_detail',{id,s:0});const list=r.playlist;if(!list)throw new Error('歌单暂时无法读取，请检查编号或登录状态。');
     const ids=(list.trackIds||[]).slice(offset,offset+50).map(t=>idValue(t.id));const detail=ids.length?await call(s,'song_detail',{ids:ids.join(',')}):{songs:[]};data={name:list.name,items:(detail.songs||[]).map(song),total:list.trackIds?.length||0,more:offset+50<(list.trackIds?.length||0)};
    }else if(route==='search'){
     const keywords=String(p.keywords||'').trim();if(!keywords||keywords.length>100)return json(res,400,{error:'请输入歌曲名或歌手（100 字以内）。'});
     const offset=offsetValue(p.offset),r=await call(s,'cloudsearch',{keywords,type:1,limit:30,offset});data={items:(r.result?.songs||[]).map(song),more:offset+30<(r.result?.songCount||0)};
    }else if(route==='stream'){
     const r=await call(s,'song_url_v1',{id:idValue(p.id),level:'exhigh',crypto:'eapi',unblock:'false'}),item=r.data?.[0],url=cdnURL(item?.url,'audio');
     if(!url)return json(res,422,{error:'这首歌暂时无法播放，可能需要会员、购买或受地区限制。'});
     data={url,trial:!!item.freeTrialInfo,expiresAt:Date.now()+Math.max(30,Number(item.expi)||1200)*1000};
    }else return json(res,404,{error:'接口不存在。'});
    json(res,200,data);return;
   }
   if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);res.end();return}
   const file=u.pathname==='/'?'index.html':decodeURIComponent(u.pathname).slice(1);
   const allowed=/^(?:index\.html|i18n\.js|style\.css|player\.js|racks\.js|apple-music\.js|netease\.js|hardware-controls\.js|geometry\.js|plastic-palette\.js|cover-policy\.js|assets\/[a-z0-9.-]+|vendor\/[a-zA-Z0-9.-]+)$/;
   if(!allowed.test(file)){res.writeHead(404);res.end();return}
   const full=path.join(root,file);if(!fs.existsSync(full)||!fs.statSync(full).isFile()){res.writeHead(404);res.end();return}
   const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.wav':'audio/wav','.mp3':'audio/mpeg','.webp':'image/webp'};
   const size=fs.statSync(full).size,headers={'Content-Type':types[path.extname(full)]||'application/octet-stream','Cache-Control':'no-cache','Accept-Ranges':'bytes'};
   let start=0,end=size-1,status=200;
   if(req.headers.range&&req.method==='GET'){
    const m=/^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
    if(!m||!m[1]&&!m[2]){res.writeHead(416,{'Content-Range':'bytes */'+size});res.end();return}
    start=m[1]?Number(m[1]):Math.max(0,size-Number(m[2]));end=m[1]&&m[2]?Math.min(Number(m[2]),size-1):size-1;
    if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>end||start>=size){res.writeHead(416,{'Content-Range':'bytes */'+size});res.end();return}
    status=206;headers['Content-Range']=`bytes ${start}-${end}/${size}`;
   }
   headers['Content-Length']=Math.max(0,end-start+1);res.writeHead(status,headers);if(req.method==='HEAD'||!size)res.end();else{const stream=fs.createReadStream(full,{start,end});stream.on('error',()=>res.destroy());res.on('close',()=>stream.destroy());stream.pipe(res)}
  }catch(error){if(!res.headersSent)json(res,error.status||502,{error:error.message||'网易云暂时不可用，请重试。'});else res.end()}
 });
 server.requestTimeout=30000;server.headersTimeout=15000;server.keepAliveTimeout=5000;
 server.on('close',()=>{clearInterval(clean);upstream.close?.();sessions.clear()});return server;
}
if(require.main===module){const port=Number(process.env.PORT||8768);const server=createServer();server.listen(port,'127.0.0.1',()=>{const url=(process.env.WALKMAN_PUBLIC_ORIGIN||`http://127.0.0.1:${server.address().port}`)+'/?v='+require('./package.json').version;console.log('SENI / POCKETMAN GitHub 版：'+url);if(process.argv.includes('--open')&&process.platform==='darwin')require('node:child_process').execFile('open',[url],()=>{})});for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{server.close(()=>process.exit(0));setTimeout(()=>process.exit(0),10000).unref()});server.on('error',e=>{console.error(e.code==='EADDRINUSE'?'端口已占用：请先关闭旧播放器服务，或设置 PORT 换一个端口。':'播放器服务启动失败。');process.exitCode=1});}
module.exports={createServer,cdnURL};
