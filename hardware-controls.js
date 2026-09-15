'use strict';
setupAppleMusic();setupRackUI();
// Both sockets and labels are printed in the regenerated chassis photograph.
// Moving caps are sampled from that same asset; the housing stays fixed.
const preferenceKeys={};
for(const [id,mark,left,label] of [['like','LIKE',46.5312,'喜欢当前歌曲'],['mode','MODE',130.5876,'切换循环模式：当前列表循环']]){
 const button=document.createElement('button');button.id='button-'+id;button.type='button';button.className='hardware top-key preference-key';button.style.left=left+'px';button.setAttribute('aria-label',label);
 const cap=document.createElement('span');cap.className='key-cap';cap.setAttribute('aria-hidden','true');button.append(cap);machine.append(button);preferenceKeys[id]=button;
}
preferenceKeys.like.setAttribute('aria-pressed','false');
// A fixed silk-screen style indicator replaces MODE after the first selection.
const modeMark=document.createElement('span');modeMark.className='mode-mark';modeMark.hidden=true;modeMark.setAttribute('aria-hidden','true');preferenceKeys.mode.append(modeMark);
const repeatMark='<path d="M20 4H7a4 4 0 0 0-4 4v1M17 1l3 3-3 3M4 12h13a4 4 0 0 0 4-4V7M7 9l-3 3 3 3"/>';
const modeMarks={
 single:repeatMark+'<path d="m10.8 6.4 1.2-.9v5m-1.5 0h3"/>',
 list:repeatMark,
 random:'<path d="M3 3h3c5 0 6 10 11 10h4m-3-3 3 3-3 3M3 13h3c2.2 0 3.6-2 5-4.5M13 5.5C14 4 15.3 3 17 3h4m-3-3 3 3-3 3"/>'
};

const keyFeedback=document.createElement('output');keyFeedback.className='key-feedback';keyFeedback.setAttribute('role','status');keyFeedback.setAttribute('aria-live','polite');machine.append(keyFeedback);
let feedbackTimer,modeStep=0;
function showKeyFeedback(key,message,duration=1800){
 clearTimeout(feedbackTimer);keyFeedback.style.left=key.id==='button-like'?'82px':key.style.left;keyFeedback.style.top=key.id==='button-like'?'112px':'-23px';keyFeedback.textContent=message;keyFeedback.classList.add('is-active');
 feedbackTimer=setTimeout(()=>{keyFeedback.classList.remove('is-active');keyFeedback.textContent=''},duration);
}
preferenceKeys.mode.onclick=()=>{
 if(audio.isStation){showKeyFeedback(preferenceKeys.mode,'电台由 Apple Music 连续推荐');return}
 keySound('mode');
 const mode=[['single','单曲循环'],['list','列表循环'],['random','随机播放']][modeStep];modeStep=(modeStep+1)%3;playbackMode=mode[0];randomHistory=[];
 modeMark.dataset.mode=mode[0];modeMark.innerHTML='<svg viewBox="0 -1 24 18" focusable="false">'+modeMarks[mode[0]]+'</svg>';modeMark.hidden=false;
 preferenceKeys.mode.setAttribute('aria-label','切换循环模式：当前'+mode[1]);showKeyFeedback(preferenceKeys.mode,mode[1]);
};
let likedSongs=null,likeNeedsRefresh=true,likeSyncVersion=0,likeAccountVersion=0,likeWriteBusy=false,likeReadPending=null;
function currentLikeTrack(){const track=tracks[current];return track.station?track.radioSong:track}
function renderLikeKey(){
 const t=currentLikeTrack()||{title:'电台歌曲准备中'},liked=t.provider==='apple'?appleFavorites.state(t):t.provider==='netease'&&likedSongs?.has(String(t.id));
 preferenceKeys.like.setAttribute('aria-pressed',String(!!liked));preferenceKeys.like.setAttribute('aria-busy',String(likeWriteBusy));
 preferenceKeys.like.disabled=likeWriteBusy||!currentLikeTrack();
 preferenceKeys.like.setAttribute('aria-label',(liked?'取消喜欢':'喜欢')+'：'+displayTrack(t).title+(t.provider==='apple'?'（同步 Apple Music）':t.provider==='netease'?'':'（需云端歌曲）'));
}
document.addEventListener('pocketman:languagechange',renderLikeKey);
async function refreshAppleLike(){
 const track=currentLikeTrack(),version=appleFavorites.version;
 if(!track||track.provider!=='apple'||likeWriteBusy)return;
 try{await appleFavorites.read(track,version)}catch{}
 if(track===currentLikeTrack()&&version===appleFavorites.version)renderLikeKey();
}
document.addEventListener('cassette-apple-accountchange',()=>{
 appleFavorites.reset();renderLikeKey();
 if(tracks[current].provider==='apple'){clearTimeout(feedbackTimer);keyFeedback.classList.remove('is-active');keyFeedback.textContent='';void refreshAppleLike()}
});
window.addEventListener('focus',()=>{void refreshAppleLike()});
async function readLikedSongs(){
 if(likeReadPending)return likeReadPending;
 const version=likeSyncVersion;
 const pending=neteaseRequest('likes').then(r=>{if(version===likeSyncVersion){if(!Array.isArray(r.ids))throw new Error('喜欢状态读取失败，请重试。');likedSongs=new Set(r.ids.map(String));likeNeedsRefresh=false;renderLikeKey()}return version===likeSyncVersion}).finally(()=>{if(likeReadPending===pending)likeReadPending=null});
 likeReadPending=pending;return pending;
}
document.addEventListener('cassette-accountchange',e=>{
 likeAccountVersion++;likeSyncVersion++;likedSongs=null;likeNeedsRefresh=true;likeReadPending=null;clearTimeout(feedbackTimer);keyFeedback.classList.remove('is-active');keyFeedback.textContent='';renderLikeKey();
 if(e.detail.profile)void readLikedSongs().catch(()=>{});
});
document.addEventListener('cassette-trackchange',()=>{clearTimeout(feedbackTimer);keyFeedback.classList.remove('is-active');keyFeedback.textContent='';renderLikeKey();void refreshAppleLike()});
preferenceKeys.like.onclick=async()=>{
 if(likeWriteBusy||!currentLikeTrack())return;
 const track=currentLikeTrack(),version=likeSyncVersion,accountVersion=likeAccountVersion;
 if(track.provider==='apple'){
  const appleVersion=appleFavorites.version;likeWriteBusy=true;renderLikeKey();showKeyFeedback(preferenceKeys.like,'正在同步 Apple Music…',26000);
  try{
   const liked=await appleFavorites.toggle(track);
   if(track===currentLikeTrack()&&appleVersion===appleFavorites.version){keySound(liked?'like-on':'like-off');showKeyFeedback(preferenceKeys.like,liked?'已收藏 · Apple Music 已同步':'已取消收藏 · Apple Music 已同步',2400)}
  }catch(error){if(track===currentLikeTrack()&&appleVersion===appleFavorites.version)showKeyFeedback(preferenceKeys.like,error.message,4500)}
  finally{likeWriteBusy=false;renderLikeKey();if(track!==currentLikeTrack()||appleVersion!==appleFavorites.version)void refreshAppleLike()}
  return;
 }
 if(track.provider!=='netease'){showKeyFeedback(preferenceKeys.like,'选一首网易云或 Apple Music 歌曲后使用',2600);return}
 likeWriteBusy=true;renderLikeKey();showKeyFeedback(preferenceKeys.like,'正在同步…',26000);
 try{
  if(likeNeedsRefresh&&!await readLikedSongs())return;
  if(version!==likeSyncVersion)return;
  const liked=!likedSongs.has(String(track.id));
  const result=await neteaseRequest('like',{id:track.id,like:liked});
  if(version!==likeSyncVersion)return;
  if(result.id!==String(track.id)||result.liked!==liked)throw new Error('状态未确认，请刷新后重试。');
  // Invalidate any list request started before this write, so it cannot undo the latch.
  likeSyncVersion++;likeReadPending=null;
  if(liked)likedSongs.add(String(track.id));else likedSongs.delete(String(track.id));
  if(track===currentLikeTrack()){keySound(liked?'like-on':'like-off');showKeyFeedback(preferenceKeys.like,liked?'已喜欢 · 网易云已同步':'已取消喜欢 · 网易云已同步',2400)}
 }catch(e){
  if(version!==likeSyncVersion)return;
  // A timed-out mutation may have reached NetEase. Re-read before the next toggle.
  likeNeedsRefresh=true;if(e.status===401)cloudAccount(null);
  if(track===currentLikeTrack())showKeyFeedback(preferenceKeys.like,e.status===401?'请在曲目中登录网易云':e.message,4500);
 }finally{
  likeWriteBusy=false;
  // A same-account status refresh can read before the in-flight write commits.
  // Retire that read as well, then reconcile with the currently signed-in account.
  if(accountVersion!==likeAccountVersion){likeSyncVersion++;likeReadPending=null;likeNeedsRefresh=true;if(cloudProfile)void readLikedSongs().catch(()=>{})}
  renderLikeKey();
  void refreshAppleLike();
 }
};
renderLikeKey();
// Restore latch state from this browser's server session without opening a dialog.
const initialLikeVersion=likeSyncVersion;
if(!isPagesDemo)void readLikedSongs().catch(()=>{if(initialLikeVersion===likeSyncVersion)renderLikeKey()});
void refreshAppleLike();

// Entry loading: keep this in the existing served bundle.
'use strict';
(async()=>{
 const root=document.documentElement,screen=document.querySelector('#entry-loader'),main=document.querySelector('main');
 const status=document.querySelector('#entry-status'),actions=document.querySelector('#entry-actions'),continueButton=document.querySelector('#entry-continue');
 const boot=window.walkmanBoot,progress=document.querySelector('#entry-progress');
 if(!boot||!screen)return;
 main.inert=true;main.setAttribute('aria-busy','true');
 let finished=false,cssReady=false;
 const blockKeys=e=>{if(root.classList.contains('is-booting')&&!e.target.closest?.('#entry-loader')){e.preventDefault();e.stopImmediatePropagation()}};
 document.addEventListener('keydown',blockKeys,true);
 function reveal(skipped=false){
  if(finished)return;finished=true;boot.finished=true;clearTimeout(boot.watchdog);clearTimeout(boot.progressTimer);
  screen.dataset.state='ready';status.textContent='准备好了';actions.hidden=true;if(progress&&!skipped){progress.style.setProperty('--loaded','1');progress.setAttribute('aria-valuenow','100')}
  setTimeout(()=>{
   root.classList.add('is-revealing');screen.classList.add('is-leaving');
   setTimeout(()=>{root.classList.remove('is-booting','is-revealing');screen.remove();main.inert=false;main.removeAttribute('aria-busy');document.removeEventListener('keydown',blockKeys,true);boot.markLoading?.(skipped?'skipped':'entered')},matchMedia('(prefers-reduced-motion: reduce)').matches?0:320);
  },skipped||matchMedia('(prefers-reduced-motion: reduce)').matches?0:500);
 }
 function recovery(message){
  if(finished)return;boot.markLoading?.('failed');clearTimeout(boot.watchdog);screen.dataset.state='error';status.textContent=message;actions.hidden=false;
  continueButton.hidden=!cssReady||typeof initialArtworkReady==='undefined'||boot.errors.length>0;
 }
 continueButton.onclick=()=>reveal(true);
 clearTimeout(boot.watchdog);boot.watchdog=setTimeout(()=>recovery('素材还在路上，可以稍等片刻或重新加载。'),60000);
 function stylesReady(){
  const link=document.querySelector('#player-styles');
  return new Promise((resolve,reject)=>{
   if(link.sheet&&link.media==='all')return resolve();
   if(boot.errors.includes(link.href))return reject(Error('stylesheet'));
   link.addEventListener('load',()=>{link.media='all';resolve()},{once:true});
   link.addEventListener('error',()=>reject(Error('stylesheet')),{once:true});
  });
 }
 try{
  await stylesReady();cssReady=true;
  if(typeof initialArtworkReady==='undefined'||boot.errors.length)throw Error('startup');
  // Prepare the listening scene, physical rack and first visible covers before entry.
  const sources=new Set(),stage=document.querySelector('.stage');
  function includeSource(src){
   if(!src)return;const url=new URL(src,document.baseURI);
   if(url.href.startsWith(new URL('assets/',document.baseURI).href))sources.add(url.href);
  }
  for(const el of [stage,...stage.querySelectorAll('*')]){
   let hidden=false;for(let node=el;node&&node!==stage.parentElement;node=node.parentElement){if(node.hidden||getComputedStyle(node).display==='none'){hidden=true;break}}
   if(hidden)continue;
   if(el.matches('img')&&el.style.visibility!=='hidden')includeSource(el.currentSrc||el.src);
   for(const pseudo of [null,'::before','::after']){
    const css=getComputedStyle(el,pseudo);
    for(const value of [css.backgroundImage,css.maskImage,css.webkitMaskImage])for(const match of (value||'').matchAll(/url\(["']?([^"')]+)["']?\)/g))includeSource(match[1]);
   }
  }
  // Rack CSS may not be displayed yet, but its physical textures will be needed immediately.
  const rack=document.querySelector('#cassette-rack');
  if(rack)for(const el of [rack,...rack.querySelectorAll('*')])for(const pseudo of [null,'::before','::after']){
   const css=getComputedStyle(el,pseudo);for(const value of [css.backgroundImage,css.maskImage,css.webkitMaskImage])for(const match of (value||'').matchAll(/url\(["']?([^"')]+)["']?\)/g))includeSource(match[1]);
  }
  document.querySelectorAll('#shelf-toggle img').forEach(img=>includeSource(img.currentSrc||img.src));
  const artwork=new Set([tracks[current]?.cover]);
  if(typeof visibleRackRows==='function'){const offset=rackWindowOffset();for(const {t} of visibleRackRows().slice(offset,offset+6))artwork.add(t.cover)}
  artwork.delete(undefined);artwork.delete('');artwork.delete('assets/cover-unavailable.svg');
  const jobs=[...sources].map(src=>async()=>{const img=new Image();img.fetchPriority='high';img.src=src;await img.decode()});
  if(typeof prepareRackAssets==='function')jobs.push(async()=>{if(!await prepareRackAssets({timeoutMs:60000}))throw Error('rack')});
  if(typeof loadCoverImage==='function')for(const src of artwork)if(!sources.has(new URL(src,document.baseURI).href))jobs.push(()=>loadCoverImage(src));
  let completed=0;const total=jobs.length;
  const decoded=await Promise.allSettled(jobs.map(async job=>{
   await job();completed++;boot.assetProgress=completed/Math.max(1,total);
  }));
  if(decoded.some(result=>result.status==='rejected')){recovery('有些素材没能加载，请重试。');return}
  if(boot.errors.length)throw Error('startup');
  boot.markLoading?.('assets_ready');
  // Enter as soon as required assets are ready, even before the 10-second progress estimate.
  requestAnimationFrame(()=>requestAnimationFrame(()=>reveal()));
 }catch{recovery('播放器未能准备好，请重新加载。')}
})();
