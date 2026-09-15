'use strict';
// MusicKit owns protected playback and user authorization. No private key is sent here.
const appleMusic={instance:null,pending:null,expiresAt:0,
 async ready(){
  if(this.instance&&Date.now()<this.expiresAt-60000)return this.instance;
  if(this.pending)return this.pending;
  this.pending=(async()=>{
   const r=await fetch('/api/apple-music/token',{method:'POST',headers:{'X-Cassette-Client':'1'},signal:AbortSignal.timeout(15000)});
   let token;try{token=await r.json()}catch{throw new Error('请重启本机播放器服务以启用 Apple Music。')}
   if(!r.ok)throw new Error(token.error||'Apple Music 配置暂时不可用。');
   if(!window.MusicKit)await new Promise((resolve,reject)=>{
    let script=document.querySelector('#musickit-sdk');
    const finish=error=>{clearTimeout(timer);document.removeEventListener('musickitloaded',loaded);if(error){script?.remove();reject(error)}else resolve()};
    const loaded=()=>finish();const timer=setTimeout(()=>finish(new Error('Apple Music 加载超时，请检查网络后重试。')),25000);
    document.addEventListener('musickitloaded',loaded,{once:true});
    if(!script){script=document.createElement('script');script.id='musickit-sdk';script.src='https://js-cdn.music.apple.com/musickit/v3/musickit.js';script.async=true;script.onerror=()=>finish(new Error('Apple Music 加载失败，请检查网络后重试。'));script.onload=()=>{if(window.MusicKit)finish()};document.head.append(script)}
   });
   this.instance=await MusicKit.configure({developerToken:token.developerToken,app:{name:'Buy me a Walkman',build:'8.31.1'},storefrontId:this.instance?.storefrontId||'cn',suppressErrorDialog:true});
   if(this.authBinding!==this.instance){
    if(this.authBinding)this.authBinding.removeEventListener?.('authorizationStatusDidChange',this.authChanged);
    this.authChanged=()=>document.dispatchEvent(new Event('cassette-apple-accountchange'));
    this.authBinding=this.instance;this.instance.addEventListener?.('authorizationStatusDidChange',this.authChanged);
   }
   this.expiresAt=token.expiresAt;return this.instance;
  })().finally(()=>{this.pending=null});return this.pending;
 }
};
// Account preferences stay in memory. A saved rack is never evidence of a cloud favorite.
const appleFavorites={version:0,states:new Map(),reads:new Map(),
 key(track){if(track.provider!=='apple'||! /^[a-zA-Z0-9.-]{1,80}$/.test(String(track.id)))throw new Error('这首歌曲没有有效的 Apple Music 编号。');return (track.library?'library-songs/':'songs/')+track.id},
 reset(){this.version++;this.states.clear();this.reads.clear()},
 state(track){return this.states.get(this.key(track))},
 check(version,music){if(version!==this.version)throw new Error('Apple Music 账号状态已变化，请重试。');if(!music.isAuthorized)throw new Error('请在曲目中连接 Apple Music 账号。')},
 async request(music,path,params={},method='GET'){
  try{
   const response=await music.api.music(path,params,{fetchOptions:{method,cache:'no-store',signal:AbortSignal.timeout(15000)}});
   if(Number(response?.status)>=400)throw {status:response.status};
   return response;
  }catch(error){
   const status=Number(error?.status||error?.statusCode||error?.response?.status||error?.data?.status||error?.data?.errors?.[0]?.status);
   throw Object.assign(new Error(status===401||status===403?'请重新连接 Apple Music，确认允许访问账号。':'Apple Music 收藏同步失败，请检查网络后重试。'),{status});
  }
 },
 async read(track,version=this.version,music){
  music=music||await appleMusic.ready();this.check(version,music);
  const key=this.key(track),revision=(this.reads.get(key)||0)+1;this.reads.set(key,revision);
  let rows;
  try{const response=await this.request(music,'/v1/me/ratings/'+key);rows=response?.data?.data}catch(error){if(error.status===404)rows=[];else throw error}
  this.check(version,music);
  if(!Array.isArray(rows))throw new Error('Apple Music 未返回有效的收藏状态，请重试。');
  const rating=rows.find(item=>String(item.id)===String(track.id));
  if((rows.length&&!rating)||(rating&&![1,-1].includes(rating.attributes?.value)))throw new Error('Apple Music 未返回有效的收藏状态，请重试。');
  const liked=rating?.attributes?.value===1;
  if(this.reads.get(key)===revision)this.states.set(key,liked);
  return liked;
 },
 async toggle(track){
  const version=this.version,music=await appleMusic.ready();this.check(version,music);
  const key=this.key(track),liked=!await this.read(track,version,music);this.check(version,music);
  this.reads.set(key,(this.reads.get(key)||0)+1);
  try{
   if(liked)await this.request(music,'/v1/me/favorites',{['ids['+(track.library?'library-songs':'songs')+']']:String(track.id)},'POST');
   else await this.request(music,'/v1/me/ratings/'+key,{},'DELETE');
   this.check(version,music);this.reads.set(key,(this.reads.get(key)||0)+1);
   // Favorite additions are asynchronous (202). Confirm the user's state before showing success.
   for(let attempt=0;attempt<4;attempt++){
    if(attempt)await new Promise(resolve=>setTimeout(resolve,350*attempt));
    if(await this.read(track,version,music)===liked)return liked;
   }
   throw new Error('Apple Music 尚未确认收藏变化，请稍后再试。');
  }catch(error){
   if(version===this.version){this.states.delete(key);this.reads.set(key,(this.reads.get(key)||0)+1)}
   throw error;
  }
 }
};
class WalkmanAudio extends EventTarget{
 constructor(local){super();this.local=local;this.track=null;this.epoch=0;this.chain=Promise.resolve();this.pausePending=Promise.resolve();this.queued='';this.wantPlay=false;this.applePaused=true;this.appleEnded=false;this.position=0;this.binding=null;
  for(const type of ['play','pause','ended','waiting','playing','canplay','timeupdate','loadedmetadata','durationchange','error'])local.addEventListener(type,()=>{if(!this.isApple)this.emit(type)});
 }
 get isApple(){return this.track?.provider==='apple'}
 get isStation(){return this.isApple&&this.track.station===true}
 emit(type){this.dispatchEvent(new Event(type))}
 use(track){this.pause();this.track=track;this.position=0;this.appleEnded=false;this.queued=''}
 get paused(){return this.isApple?this.applePaused:this.local.paused}
 get ended(){return this.isApple?this.appleEnded:this.local.ended}
 get duration(){return this.isApple?(this.queued===this.track.id&&Number(this.binding?.currentPlaybackDuration)>0?this.binding.currentPlaybackDuration:this.track.duration||0):this.local.duration}
 get currentTime(){return this.isApple?this.position:this.local.currentTime}
 set currentTime(value){if(this.isStation)return;if(!this.isApple){this.local.currentTime=value;return}this.position=Math.max(0,Math.min(this.duration||Infinity,Number(value)||0));if(this.queued===this.track.id){const epoch=this.epoch;Promise.resolve(this.binding.seekToTime(this.position)).catch(()=>{if(epoch===this.epoch)this.emit('error')})}this.emit('timeupdate')}
 get volume(){return this.local.volume}
 set volume(value){this.local.volume=value;if(this.binding)this.binding.volume=this.muted?0:value}
 get muted(){return this.local.muted}
 set muted(value){this.local.muted=value;if(this.binding)this.binding.volume=value?0:this.volume}
 set src(value){this.local.src=value}
 get src(){return this.local.src}
 removeAttribute(name){this.local.removeAttribute(name)}
 load(){if(this.isApple){this.emit('loadedmetadata');return}this.local.load()}
 bind(music){if(this.binding===music)return;this.binding=music;music.volume=this.muted?0:this.volume;music.repeatMode=MusicKit.PlayerRepeatMode.none;music.shuffleMode=MusicKit.PlayerShuffleMode.off;
  music.addEventListener('nowPlayingItemDidChange',()=>this.stationItem(music));
  for(const event of ['queueItemsDidChange','queuePositionDidChange'])music.addEventListener(event,()=>this.stationQueue(music));
  music.addEventListener('playbackTimeDidChange',()=>{if(this.binding===music&&this.isApple&&this.queued===this.track.id){this.position=Number(music.currentPlaybackTime)||0;this.emit('timeupdate')}});
  music.addEventListener('playbackDurationDidChange',()=>{if(this.binding===music&&this.isApple&&this.queued===this.track.id)this.emit('durationchange')});
  music.addEventListener('playbackStateDidChange',()=>{
   if(this.binding!==music||!this.isApple||this.queued!==this.track.id)return;
   const state=music.playbackState,states=MusicKit.PlaybackStates;
   if(state===states.playing){if(!this.wantPlay){this.pauseSDK();return}const start=!this.started;this.started=true;this.applePaused=false;this.appleEnded=false;if(start)this.emit('play');this.emit('playing');this.stationItem(music)}
   else if(state===states.paused||state===states.stopped){this.applePaused=true;this.emit('pause')}
   else if(state===states.waiting||state===states.loading){if(this.wantPlay)this.emit('waiting')}
   // For stations, an individual track ending belongs to MusicKit's continuous queue.
   else if(state===states.ended&&this.isStation){if(this.wantPlay)this.emit('waiting')}
   else if((state===states.ended||state===states.completed)&&this.wantPlay&&!this.appleEnded){this.wantPlay=false;this.applePaused=true;this.appleEnded=true;this.emit('ended')}
  });
  music.addEventListener('mediaPlaybackError',()=>{if(this.binding===music&&this.isApple){this.wantPlay=false;this.applePaused=true;this.emit('error')}});
 }
 stationItem(music){
  if(this.binding!==music||!this.isStation||this.queued!==this.track.id)return;
  const song=appleQueueSong(music.nowPlayingItem),track=this.track;
  if(track.radioSong?.id!==song?.id){
   track.radioHeard=false;track.radioSong=song;track.radioUpcoming=[];
   this.position=Number(music.currentPlaybackTime)||0;this.emit('stationitemchange');
  }
  this.stationQueue(music);this.stationHeard(music);
 }
 stationHeard(music){
  if(this.binding!==music||!this.isStation||this.queued!==this.track.id||!this.wantPlay||music.playbackState!==MusicKit.PlaybackStates.playing)return;
  const song=appleQueueSong(music.nowPlayingItem);
  if(!song||song.id!==this.track.radioSong?.id||this.track.radioHeard)return;
  this.track.radioHeard=true;this.emit('stationheard');
 }
 stationQueue(music){
  if(this.binding!==music||!this.isStation||this.queued!==this.track.id)return;
  const queue=music.queue,items=queue?.items,position=queue?.position;
  // Ignore a queue still pointing at the previous song during a transition.
  const aligned=Array.isArray(items)&&Number.isInteger(position)&&position>=0&&appleQueueSong(items[position])?.id===this.track.radioSong?.id;
  const upcoming=aligned?items.slice(position+1).map(appleQueueSong).filter(Boolean):[];
  if(JSON.stringify(upcoming)!==JSON.stringify(this.track.radioUpcoming||[])){this.track.radioUpcoming=upcoming;this.emit('stationqueuechange')}
 }
 async skipStation(){
  if(!this.isStation||this.queued!==this.track.id||!this.binding)throw new Error('请先开始收听电台。');
  const epoch=this.epoch,music=this.binding;
  const job=async()=>{if(epoch!==this.epoch)return;await music.skipToNextItem();if(epoch===this.epoch)this.stationItem(music)};
  const result=this.chain.catch(()=>{}).then(job);this.chain=result;await result;
 }
 pauseSDK(){if(this.binding)this.pausePending=Promise.all([this.pausePending,Promise.resolve(this.binding.pause())]).catch(()=>{})}
 pause(){this.started=false;this.epoch++;this.wantPlay=false;this.local.pause();if(this.isApple){this.applePaused=true;this.pauseSDK();this.emit('pause')}}
 async play(){if(!this.isApple)return this.local.play();
  const epoch=++this.epoch,track=this.track;this.wantPlay=true;this.applePaused=false;this.emit('waiting');
  const job=async()=>{
   await this.pausePending;if(epoch!==this.epoch)return;
   const music=await appleMusic.ready();if(epoch!==this.epoch)return;
   if(!music.isAuthorized){this.wantPlay=false;throw new Error('请先在“曲目 → Apple Music”中连接你的 Apple Music 账号。')}
   this.bind(music);this.appleEnded=false;
   if(this.queued!==track.id){
    const descriptor=track.station?{station:track.id}:track.library?{items:(await music.api.music('/v1/me/library/songs/'+encodeURIComponent(track.id))).data.data}:{song:track.id};
    if(epoch!==this.epoch)return;
    await music.setQueue(descriptor);
    if(epoch!==this.epoch){await music.pause();return}
    this.queued=track.id;
    if(this.position>0&&!track.station)await music.seekToTime(this.position);
   }
   if(epoch!==this.epoch)return;
   await music.play();if(epoch!==this.epoch){await music.pause();return}
   this.stationItem(music);
   // Only the SDK playbackStateDidChange event confirms audible playback.
  };
  const result=this.chain.catch(()=>{}).then(job);this.chain=result;
  try{await result}catch(e){if(epoch===this.epoch){this.wantPlay=false;this.applePaused=true}throw e}
 }
}
function appleArtwork(value){try{const u=new URL(String(value||'').replace(/\{w\}|\{h\}/g,'1000').replace('{f}','jpg'));return u.protocol==='https:'&&!u.port&&!u.username&&!u.password&&u.hostname.endsWith('.mzstatic.com')?'/api/apple-music/image?url='+encodeURIComponent(u.href):'assets/cover-unavailable.svg'}catch{return 'assets/cover-unavailable.svg'}}
function appleSong(item){const a=item.attributes||{},catalog=a.playParams?.catalogId;
 const id=String(catalog||item.id||'');if(!/^[a-zA-Z0-9.-]{1,80}$/.test(id))return null;
 const sourceURL=typeof a.url==='string'&&/^https:\/\/music\.apple\.com\//.test(a.url)?a.url:'';
 return {provider:'apple',id,library:!catalog&&item.type==='library-songs',title:a.name||'未命名曲目',artist:a.artistName||'',album:a.albumName||'',year:(a.releaseDate||'').slice(0,4),duration:(Number(a.durationInMillis)||0)/1000,cover:appleArtwork(a.artwork?.url),sourceURL,variant:'sunset',description:'Apple Music',src:''};
}
function appleQueueSong(item){
 const a=item?.attributes||item,id=a?.playParams?.catalogId||a?.playParams?.id||item?.id;
 // Only real catalog songs enter the rack or song favorite endpoints.
 return a&&/^\d+$/.test(String(id||''))?appleSong({id:String(id),type:'songs',attributes:{...a,name:a.name||a.title}}):null;
}
function applePlaylistLink(value){
 try{const u=new URL(String(value).trim());if(u.protocol!=='https:'||u.hostname!=='music.apple.com'||u.port||u.username||u.password)return null;
  const parts=u.pathname.split('/').filter(Boolean),id=parts.at(-1);
  if(!/^[a-z]{2}$/.test(parts[0])||parts[1]!=='playlist'||![3,4].includes(parts.length)||!/^pl\.[a-zA-Z0-9.-]{1,120}$/.test(id))return null;
  return {storefront:parts[0],id};
 }catch{return null}
}
// Keep errors useful without exposing SDK payloads, Apple IDs or tokens.
function appleAuthorizationError(error){
 const raw=typeof error==='string'?error:error?.name;
 if(raw==='Storefront Country Code error.')return 'Apple 登录已返回，但账号地区校验失败（ACCOUNT_REGION_FAILED）。请确认该账号能在 Apple Music 中正常使用，再重试。';
 if(raw==='AUTHORIZATION_ERROR')return 'Apple 未完成 MusicKit 授权（AUTHORIZATION_ERROR）。若已经点过允许，请确认 Apple Music 订阅有效后重试；这不等同于弹窗被拦截。';
 if(raw==='SUBSCRIPTION_ERROR')return 'Apple Music 订阅校验失败（SUBSCRIPTION_ERROR）。请检查当前 Apple 账号的订阅。';
 if(raw==='TypeError'||raw==='NetworkError')return 'Apple 授权过程发生网络错误（NETWORK_ERROR），请检查网络后重试。';
 if(raw==='SecurityError'||raw==='NotAllowedError')return '浏览器拒绝了授权操作（BROWSER_PERMISSION）。请检查此网站的弹窗与存储权限。';
 if(raw==='AbortError')return 'Apple 授权已取消（AUTH_CANCELLED），可以重新连接。';
 if(raw==='AUTH_NOT_CONFIRMED')return 'Apple 登录窗口已返回，但未确认 MusicKit 授权（AUTH_NOT_CONFIRMED）。请重新连接，并确认允许访问 Apple Music。';
 return 'Apple Music 授权未完成（AUTH_UNKNOWN）。请重试；如仍失败，请提供这条错误提示。';
}
// Called after the player has created its existing dialog and rack helpers.
function setupAppleMusic(){
 const box=$('#apple-music');let music,version=0,items=[],view=null,next=null,authBusy=false;
 setMusicShortcutSelection(box);
 const message=(text,error=false)=>{$('#apple-feedback').textContent=text;$('#apple-feedback').dataset.error=String(error)};
 const errorMessage=e=>e?.message?.startsWith('请')||e?.message?.startsWith('Apple Music')?e.message:'Apple Music 暂时无法读取，请检查授权、网络或账号地区后重试。';
 function account(){const signed=!!music?.isAuthorized;$('#apple-account-name').textContent=signed?'已连接 Apple Music':'未连接 · 可以先搜索歌曲';$('#apple-login').hidden=signed;$('#apple-login').disabled=!music||authBusy;$('#apple-logout').hidden=!signed;$('#apple-library').hidden=!signed;$('#apple-playlists').hidden=!signed;$('#apple-station').hidden=!signed;$('#apple-storefront').disabled=signed;document.dispatchEvent(new Event('cassette-apple-accountchange'))}
 async function storefront(){if(!music.isAuthorized)return;try{const r=await music.api.music('/v1/me/storefront');const id=r.data.data[0]?.id;if(id){if(![...$('#apple-storefront').options].some(o=>o.value===id))$('#apple-storefront').add(new Option(id.toUpperCase(),id));$('#apple-storefront').value=id}}catch{message('账号已连接，地区读取失败；搜索暂用当前地区。',true)}}
 $('#apple-open').onclick=async()=>{openMusicProvider(box);message('正在连接 Apple Music…');try{music=await appleMusic.ready();account();await storefront();if(box.open)message(music.isAuthorized?'可以搜索歌曲，或读取你的资料库。':'连接账号后可播放完整歌曲，需要有效的 Apple Music 订阅。')}catch(e){message(errorMessage(e),true)}};
 $('#apple-login').onclick=async()=>{
  if(!music||authBusy)return;authBusy=true;account();message('请在 Apple 弹窗中登录并授权。');
  try{await music.authorize();if(!music.isAuthorized)throw Object.assign(new Error('Authorization not confirmed'),{name:'AUTH_NOT_CONFIRMED'});await storefront();message('已连接，可以把资料库中的歌曲加入磁带架。')}catch(e){message(appleAuthorizationError(e),true)}finally{authBusy=false;account()}
 };
 $('#apple-logout').onclick=async()=>{if(authBusy)return;authBusy=true;$('#apple-logout').disabled=true;version++;if(tracks[current].provider==='apple'){requestId++;audio.pause();loading=false;playbackUI()}
  try{await music.unauthorize();radioQueues.clear();renderTracks();items=[];view=null;next=null;setMusicShortcutSelection(box);$('#apple-results').replaceChildren();$('#apple-more').hidden=true;$('#apple-add-page').hidden=true;message('已断开 Apple Music，磁带列表仍保留。')}catch{message('断开失败，请重试。',true)}finally{authBusy=false;$('#apple-logout').disabled=false;account()}
 };
 function add(songs,choose=false){importRackSongs(songs,{choose,name:view?.title||'Apple Music 歌曲',source:view&&['playlist','shared'].includes(view.type)?{provider:'apple',id:view.id}:null,onDone:count=>{message('已加入 '+count+' 首歌曲。');render()}})}
 function render(){
  const list=$('#apple-results');list.replaceChildren();
  for(const item of items){
   const row=document.createElement('div');row.className='cloud-row';const img=new Image();img.src=item.cover;img.alt='';img.loading='lazy';img.onerror=()=>{img.onerror=null;img.src='assets/cover-unavailable.svg'};
   const info=document.createElement('div');info.className='cloud-row-info';const title=document.createElement('strong'),detail=document.createElement('small');title.textContent=item.title;
   detail.textContent=view.type==='playlists'?'我的歌单':view.type==='station'?'Apple Music 为你连续推荐':[item.artist,item.album].filter(Boolean).join(' · ');if(!['playlists','station'].includes(view.type))detail.setAttribute('translate','no');info.append(title,detail);
   const button=document.createElement('button');button.type='button';button.textContent=view.type==='playlists'?'打开':view.type==='station'?'开始收听':'加入';button.setAttribute('aria-label',button.textContent+' '+item.title);
   if(view.type==='playlists')button.onclick=()=>load({type:'playlist',id:item.id,title:item.title});
   else if(view.type==='station')button.onclick=()=>startRadioRack(item);
   else{button.disabled=targetHasSong(item);if(button.disabled)button.textContent='已加入';button.onclick=()=>add([item])}
   row.append(img,info,button);list.append(row);
  }
  $('#apple-add-page').hidden=!items.length||['playlists','station'].includes(view.type);
 }
 async function load(target,append=false){const revision=++version;message('正在读取…');$('#apple-more').disabled=true;$('#apple-add-page').disabled=true;
  if(!append){view=target;items=[];next=null;setMusicShortcutSelection(box,({station:'apple-station',library:'apple-library',playlists:'apple-playlists',playlist:'apple-playlists'})[target.type]);render();$('#apple-more').hidden=true;$('#apple-results-title').textContent=target.type==='station'?'我的电台':target.type==='library'?'我的歌曲':target.type==='playlists'?'我的歌单':target.title||'搜索结果';if(target.title&&!['station','library','playlists','search'].includes(target.type))PocketmanI18n.setNamedTitle($('#apple-results-title'),target.title)}
  try{
   music=await appleMusic.ready();account();if(!['search','shared'].includes(target.type)&&!music.isAuthorized)throw new Error('请先连接 Apple Music 账号。');
   const sf=$('#apple-storefront').value;let path,params={limit:25};
   if(append){
    const allowed=target.type==='search'?'/v1/catalog/'+sf+'/search':target.type==='shared'?'/v1/catalog/'+target.storefront+'/playlists/'+encodeURIComponent(target.id)+'/tracks':target.type==='playlists'?'/v1/me/library/playlists':target.type==='library'?'/v1/me/library/songs':'/v1/me/library/playlists/'+encodeURIComponent(target.id)+'/tracks';
    if(!next||next.split('?')[0]!==allowed)throw new Error('Apple Music 分页地址无效。');path=next;params={};
   }
   else if(target.type==='search'){path='/v1/catalog/'+sf+'/search';params={term:target.term,types:'songs',limit:25}}
   else if(target.type==='library')path='/v1/me/library/songs';
   else if(target.type==='playlists')path='/v1/me/library/playlists';
   else if(target.type==='station'){path='/v1/catalog/'+sf+'/stations';params={'filter[identity]':'personal'}}
   else if(target.type==='shared')path='/v1/catalog/'+target.storefront+'/playlists/'+encodeURIComponent(target.id)+'/tracks';
   else path='/v1/me/library/playlists/'+encodeURIComponent(target.id)+'/tracks';
   const response=await music.api.music(path,params);if(revision!==version||!box.open)return;
   const data=target.type==='search'?response.data.results?.songs:response.data;
   const incoming=(data?.data||[]).filter(i=>target.type!=='playlists'||i.attributes?.canEdit===true).map(i=>['playlists','station'].includes(target.type)?{id:i.id,title:i.attributes?.name||(target.type==='station'?'我的电台':'未命名歌单'),cover:appleArtwork(i.attributes?.artwork?.url),sourceURL:i.attributes?.url||''}:appleSong(i)).filter(Boolean);
   view=target;items=append?[...items,...incoming]:incoming;next=target.type==='station'?null:data?.next||null;render();$('#apple-more').hidden=!next;
   $('#apple-results-title').textContent=target.type==='search'?'搜索结果':target.type==='library'?'我的歌曲':target.type==='playlists'?'我的歌单':target.type==='station'?'我的电台':target.title;if(target.title&&!['station','library','playlists','search'].includes(target.type))PocketmanI18n.setNamedTitle($('#apple-results-title'),target.title);
   message(target.type==='station'?(items.length?'点“开始收听”，Apple Music 会连续为你推荐歌曲。':'Apple Music 暂未返回你的个人电台，请稍后重试。'):items.length?'已显示 '+items.length+(target.type==='playlists'?' 个歌单':' 首歌曲'):next?'本页没有符合条件的内容，可继续加载更多。':target.type==='playlists'?'还没有可编辑的个人歌单。其他歌单可以通过分享链接打开。':'这里暂时没有歌曲，可以试试搜索。');
  }catch(e){if(revision===version)message(errorMessage(e),true)}finally{if(revision===version){$('#apple-more').disabled=false;$('#apple-add-page').disabled=false}}
 }
 $('#apple-storefront').onchange=()=>{version++;items=[];view=null;next=null;setMusicShortcutSelection(box);$('#apple-results').replaceChildren();$('#apple-more').hidden=true;$('#apple-add-page').hidden=true;message('地区已切换，请重新搜索。')};
 $('#apple-playlist').onsubmit=e=>{e.preventDefault();const shared=applePlaylistLink($('#apple-playlist-url').value);if(!shared){message('请粘贴 music.apple.com 的歌单分享链接。',true);return}return load({type:'shared',...shared,title:'分享歌单'})};
 $('#apple-search').onsubmit=e=>{e.preventDefault();const term=$('#apple-keywords').value.trim();if(term)load({type:'search',term})};$('#apple-station').onclick=()=>load({type:'station'});$('#apple-library').onclick=()=>load({type:'library'});$('#apple-playlists').onclick=()=>load({type:'playlists'});$('#apple-more').onclick=()=>{if(view)load(view,true)};$('#apple-add-page').onclick=()=>add(items,true);
 box.addEventListener('close',()=>{version++;$('#apple-more').disabled=false;$('#apple-add-page').disabled=false});
 account();
}
