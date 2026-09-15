'use strict';
const $=s=>document.querySelector(s), audio=new WalkmanAudio($('#audio')), machine=$('#machine'), fit=$('.fit');
const layers=new Map(), tracks=[
 {title:'霓虹夜行',src:'assets/neon-night.mp3',cover:'assets/cover-neon-night.8068b0601ad1.webp',artist:'艺术家不详',album:'都会循环',year:'不详',duration:60.029388,variant:'sunset',edition:'neon',printStyle:'studio',spineStyle:'colour',plastic:plasticPalette[4],coverInfo:{src:'assets/cover-neon-night.8068b0601ad1.webp',valid:true,width:1254,height:1254},description:'霓虹夜行 · 都会循环版 · 原创演示曲'}
];
let current=0, doorOpen=false, loading=false, requestId=0, zoom=1.1, dx=0,dy=0, bgURL=null, backgroundVersion=0;
let browsing=false, stageAnimation;
let pulled=-1, swapping=false, swapVersion=0;
let playbackMode='list',randomHistory=[];
let stopped=false;
const stopEffects={frame:0,animations:new Set(),canvas:null,fire:null,version:0,papers:null};
const swapAnimations=new Set();
const urls=new Set(), reduceMotion=matchMedia('(prefers-reduced-motion: reduce)');
const icons={play:'<path d="M7 3L21 12 7 21Z"/>',pause:'<path d="M6 3h4v18H6zm9 0h4v18h-4z"/>'};
const buttonNames={'button-prev':'上一首','button-play':'播放','button-next':'下一首','button-stop':'停止','button-eject':'打开磁带仓'};
const cassette=document.createElement('div');cassette.className='cassette-group';machine.append(cassette);
for(const l of geometry){
 if(['tape-left','tape-right','hub-left','hub-right'].includes(l.id))continue;
 const isButton=l.id.startsWith('button-'), el=document.createElement(isButton?'button':'div');
 el.className=isButton?'hardware':'layer';el.dataset.id=l.id;
 const b=l.b;Object.assign(el.style,{left:b.x+'px',top:b.y+'px',width:b.width+'px',height:b.height+'px',zIndex:l.z});
 const img=document.createElement('img');img.src=l.asset;img.alt='';img.draggable=false;el.append(img);
 if(l.origin){img.className='rotor';img.style.transformOrigin=l.origin.map(v=>v*750/1536+'px').join(' ')}
 if(isButton){el.setAttribute('aria-label',buttonNames[l.id]);el.title=buttonNames[l.id];if(['button-stop','button-eject'].includes(l.id))el.classList.add('top-key')}
 (l.id==='door-frame'?$('#door'):['cassette-shell','album-label','tape-left','tape-right','hub-left','hub-right'].includes(l.id)?cassette:machine).append(el);layers.set(l.id,el);
}
// GitHub edition: editable vector marks, independent of the photographic chassis.
for(const [name,label] of [['seni','SENI'],['pocketman','POCKETMAN']]){
 const mark=document.createElement('img');mark.className='chassis-wordmark chassis-wordmark-'+name;mark.src='assets/brand-'+name+'.svg';mark.alt=label;mark.draggable=false;machine.append(mark);
}
const playBtn=layers.get('button-play'), ejectBtn=layers.get('button-eject');
const volumeRotor=layers.get('volume-wheel'),wheelSurface=document.createElement('span'),wheelTread=document.createElement('span');
wheelSurface.className='wheel-surface';wheelSurface.setAttribute('aria-hidden','true');wheelTread.className='wheel-tread';
for(let i=0;i<25;i++){const ridge=document.createElement('i');wheelTread.append(ridge)}
wheelSurface.append(wheelTread);volumeRotor.append(wheelSurface);
let wheelPosition=null,wheelTarget=0,wheelFrame=0,wheelTime=0;
function paintWheel(){const pitch=3.3;wheelTread.style.transform=`translateY(${((wheelPosition%pitch)+pitch)%pitch-pitch}px)`}
function stopWheel(){cancelAnimationFrame(wheelFrame);wheelFrame=0;wheelTime=0;wheelPosition=wheelTarget;paintWheel();volumeRotor.classList.remove('turning')}
function stepWheel(time){
 const elapsed=wheelTime?Math.min(time-wheelTime,48):16;wheelTime=time;
 wheelPosition+=(wheelTarget-wheelPosition)*(1-Math.exp(-elapsed/55));paintWheel();
 if(Math.abs(wheelTarget-wheelPosition)<.015){stopWheel();return}
 wheelFrame=requestAnimationFrame(stepWheel);
}
function turnVolumeWheel(value){
 wheelTarget=-value*.9;
 if(wheelPosition===null||reduceMotion.matches){stopWheel();return}
 if(Math.abs(wheelTarget-wheelPosition)<.015)return;
 volumeRotor.classList.add('turning');
 if(!wheelFrame){wheelTime=0;wheelFrame=requestAnimationFrame(stepWheel)}
}
reduceMotion.addEventListener('change',()=>{if(reduceMotion.matches)stopWheel()});

const patch=document.createElement('span');patch.className='play-patch';patch.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true">'+icons.play+'</svg>';playBtn.append(patch);
const playCap=document.createElement('span');playCap.className='play-key-cap';playCap.append(playBtn.querySelector('img'),patch);playBtn.append(playCap);
const stopBtn=layers.get('button-stop'),stopCap=document.createElement('span');stopCap.className='stop-key-cap';stopCap.setAttribute('aria-hidden','true');stopBtn.append(stopCap);
for(const [id,path] of [['button-prev','M5 3h3v18H5zm15 0L8 12l12 9z'],['button-next','M16 3h3v18h-3zM4 3v18l12-9z']]){
 const overlay=document.createElement('span');overlay.className='play-patch skip-patch';overlay.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="'+path+'"/></svg>';layers.get(id).append(overlay);
}
const label=layers.get('album-label'), shell=layers.get('cassette-shell');
const dynamic=document.createElement('div');dynamic.className='dynamic-label';
const tapeWindow=document.createElement('div');tapeWindow.className='tape-window';dynamic.append(tapeWindow);
// The approved hubless module is fixed. Only circular crops of the white hubs
// from the other generated image rotate above its two spindle seats.
const reelWell=document.createElement('div');reelWell.className='reel-well';reelWell.setAttribute('aria-hidden','true');
const labelBounds=geometry.find(l=>l.id==='album-label').b;
Object.assign(reelWell.style,{left:(labelBounds.x+68)+'px',top:(labelBounds.y+47)+'px'});
reelWell.innerHTML='<div class="reel-assembly"><img class="reel-assembly-art" src="assets/reel-module-neutral.239882c8ff21.webp" alt="" draggable="false"><span class="unified-hub unified-hub-left rotor"></span><span class="unified-hub unified-hub-right rotor"></span></div>';
cassette.append(reelWell);
const sideMark=document.createElement('span');sideMark.className='side-mark';sideMark.textContent='SIDE A';dynamic.append(sideMark);
const customTitle=document.createElement('span');customTitle.className='custom-title';
const thumb=document.createElement('img');thumb.className='custom-thumbnail';thumb.alt='';dynamic.append(thumb,customTitle);label.append(dynamic);
const printDetails=document.createElement('div');printDetails.className='print-details';printDetails.setAttribute('aria-hidden','true');
printDetails.innerHTML='<svg viewBox="0 0 414 167" preserveAspectRatio="none"><rect class="print-outline" x="9" y="7" width="396" height="152" rx="9"/><path class="writing-lines" d="M78 27H390M78 43H390"/><path class="edge-lines" d="M12 60H60M12 64H60M12 68H60M12 126H60M12 130H60M12 134H60M348 60H402M348 64H402M348 68H402M348 126H402M348 130H402M348 134H402"/><path class="window-scale" d="M191 89H228M191 85V93M200 87V91M209 85V93M218 87V91M228 85V93"/></svg><span class="record-mark">A</span><span class="print-footer">COMPACT CASSETTE</span><span class="print-stereo">STEREO</span>';
const artistLine=document.createElement('span');artistLine.className='print-artist';dynamic.append(printDetails,artistLine);
// The back label is another printed face of the same cassette; audio is untouched.
let cassetteSide='A',sideAnimation;
const backDetails=document.createElement('div');backDetails.className='back-details';backDetails.id='cassette-back-details';backDetails.hidden=true;
backDetails.innerHTML='<div class="back-heading"><span class="back-caption">ALBUM / 专辑</span><strong class="back-album"></strong><span class="back-artist"></span></div><div class="back-facts"><span class="back-caption">YEAR / 年份</span><strong class="back-year"></strong><span class="back-caption">TIME / 时长</span><span class="back-duration"></span></div><div class="back-footer"><span class="back-song"></span><span class="back-source"></span></div>';
dynamic.append(backDetails);
const flipHit=document.createElement('button');flipHit.className='cassette-flip-hit';flipHit.id='cassette-flip';flipHit.setAttribute('aria-controls',backDetails.id);machine.append(flipHit);
const shellBounds=geometry.find(l=>l.id==='cassette-shell').b;
Object.assign(flipHit.style,{left:shellBounds.x+'px',top:shellBounds.y+'px',width:shellBounds.width+'px',height:shellBounds.height+'px'});
function trackYear(track){
 const value=String(track.year||'').trim(),match=value.match(/^(\d{4})(?:$|[-/])/);
 if(match&&Number(match[1])>=1000&&Number(match[1])<=2999)return match[1];
 const stamp=Number(track.publishTime);if(Number.isFinite(stamp)&&stamp>0){const year=new Date(stamp).getUTCFullYear();if(year>=1000&&year<=2999)return String(year)}
 return value==='不详'?'不详':'未提供';
}
function renderBackDetails(){
 const t=tracks[current];backDetails.querySelector('.back-album').textContent=t.album||'专辑未提供';
 backDetails.querySelector('.back-artist').textContent=t.artist||'歌手未提供';
 backDetails.querySelector('.back-year').textContent=trackYear(t);
 const duration=Number(t.duration)>0?Number(t.duration):audio.duration;
 backDetails.querySelector('.back-duration').textContent=Number.isFinite(duration)&&duration>0?format(duration):'未提供';
 backDetails.querySelector('.back-song').textContent=t.title;backDetails.querySelector('.back-song').title=t.title;
 backDetails.querySelector('.back-source').textContent=t.provider==='apple'?'APPLE MUSIC':t.provider==='netease'?'NETEASE MUSIC':t.local?'LOCAL MUSIC':'ORIGINAL DEMO';
 backDetails.querySelector('.back-album').title=t.album||'专辑未提供';backDetails.querySelector('.back-artist').title=t.artist||'歌手未提供';
}
function setCassetteSide(side,{animate=false}={}){
 sideAnimation?.cancel();sideAnimation=null;cassetteSide=side;dynamic.dataset.side=side;sideMark.textContent=side;printDetails.querySelector('.record-mark').textContent=side;
 backDetails.hidden=side!=='B';$('#cover-open').hidden=side==='B';flipHit.setAttribute('aria-label',side==='A'?'翻到磁带 B 面，查看曲目资料':'翻回磁带 A 面');flipHit.setAttribute('aria-pressed',String(side==='B'));
 if(side==='B'){renderBackDetails();flipHit.setAttribute('aria-describedby',backDetails.id)}else flipHit.removeAttribute('aria-describedby');
 if(animate&&!reduceMotion.matches)sideAnimation=label.animate([{opacity:.35},{opacity:1}],{duration:220,easing:'ease-out'});
}
flipHit.onclick=()=>{if(!doorOpen&&!swapping)setCassetteSide(cassetteSide==='A'?'B':'A',{animate:true})};
reduceMotion.addEventListener('change',()=>{if(reduceMotion.matches){sideAnimation?.cancel();sideAnimation=null}});
function notice(text){$('#notice').textContent=text;clearTimeout(notice.timer);notice.timer=setTimeout(()=>$('#notice').textContent='',5000)}
function positionPlayerFeedback(){
 const dock=$('.player-feedback');if(!dock)return;
 const viewport=window.visualViewport,margin=16,gap=10;
 const width=viewport?.width||document.documentElement.clientWidth,viewHeight=viewport?.height||document.documentElement.clientHeight;
 const left=viewport?.offsetLeft||0,viewTop=viewport?.offsetTop||0;
 // Mobile layout overflow can make innerWidth/innerHeight larger than the visible screen.
 dock.style.width=Math.max(0,Math.min(680,width-margin*2))+'px';dock.style.left=(left+width/2)+'px';
 const height=dock.offsetHeight;if(!height)return;
 const box=dock.getBoundingClientRect(),minTop=viewTop+margin,maxTop=Math.max(minTop,viewTop+viewHeight-height-margin);
 // Find a visible band clear of controls, including at short heights or after dragging.
 const controls=[...document.querySelectorAll('main button,main input')].filter(el=>!el.disabled&&!el.closest('[inert]')&&getComputedStyle(el).visibility!=='hidden').map(el=>el.getBoundingClientRect()).filter(r=>r.width&&r.height&&r.right>box.left&&r.left<box.right&&r.bottom>viewTop&&r.top<viewTop+viewHeight);
 const candidates=[maxTop,...controls.map(r=>r.top-height-gap),minTop].map(y=>Math.max(minTop,Math.min(maxTop,y)));
 const score=y=>controls.reduce((sum,r)=>sum+Math.max(0,Math.min(y+height+gap,r.bottom)-Math.max(y-gap,r.top)),0);
 let top=candidates[0],best=score(top);for(const candidate of candidates){const value=score(candidate);if(value<best){top=candidate;best=value}if(!best)break}
 dock.style.top=top+'px';dock.style.bottom='auto';
}
new ResizeObserver(positionPlayerFeedback).observe($('.player-feedback'));
window.addEventListener('scroll',positionPlayerFeedback,{passive:true});
window.addEventListener('resize',positionPlayerFeedback,{passive:true});
window.visualViewport?.addEventListener('resize',positionPlayerFeedback,{passive:true});
window.visualViewport?.addEventListener('scroll',positionPlayerFeedback,{passive:true});
let playbackFailure=null,playbackWatchTimer=0,playbackLastPosition=0;
function clearPlaybackWatch(){clearTimeout(playbackWatchTimer);playbackWatchTimer=0}
function clearPlaybackFailure(){playbackFailure=null;$('#playback-error').hidden=true}
function playbackProblem(message,action='retry'){
 playbackFailure={message,action};$('#playback-error-message').textContent=message;
 $('#playback-recover').textContent=action==='login'?'登录网易云':action==='apple'?'检查 Apple Music':'重试播放';
 $('#playback-error').hidden=false;positionPlayerFeedback();$('#notice').textContent='';clearTimeout(notice.timer);playbackUI();
}
function watchPlayback(id=requestId,track=tracks[current]){
 clearPlaybackWatch();playbackLastPosition=audio.currentTime||0;playbackWatchTimer=setTimeout(()=>{
  if(id!==requestId||track!==tracks[current]||doorOpen||swapping)return;
  if(document.hidden){watchPlayback(id,track);return}
  requestId++;audio.pause();loading=false;
  if(track.provider==='netease'){track.src='';track.streamExpires=0}
  document.dispatchEvent(new CustomEvent('cassette-playbackfailure',{detail:{name:'NetworkError'}}));
  playbackProblem('音乐加载超过 15 秒仍未开始或继续，请检查网络后重试。');
 },15000);
}
async function reportPlaybackFailure(error,id,track){
 if(id!==requestId||track!==tracks[current])return;
 clearPlaybackWatch();audio.pause();loading=false;
 document.dispatchEvent(new CustomEvent('cassette-playbackfailure',{detail:{name:error.name}}));
 if(track.provider==='netease'){track.src='';track.streamExpires=0}
 const loginMessage='网易云当前未登录或登录已失效，请重新扫码后再播放。';
 if(error.status===401){if(typeof cloudAccount==='function')cloudAccount(null);playbackProblem(loginMessage,'login');return}
 if(error.name==='NotAllowedError'){playbackProblem('浏览器未允许播放音乐，请点击“重试播放”。');return}
 if(track.provider==='netease'){
  const message=error.status===422?'网易云暂未提供这首歌的音源，可能受会员、购买或地区权限限制。':'网易云音乐暂时无法加载，请检查网络后重试，或换一首歌。';
  playbackProblem(message);
  if(error.status===422||error.name==='NotSupportedError'||error.mediaError){
   const failure=playbackFailure;
   try{
    const result=await neteaseRequest('status',{}, {timeoutMs:6000});
    if(id!==requestId||track!==tracks[current]||playbackFailure!==failure)return;
    if(typeof cloudAccount==='function')cloudAccount(result.profile);
    if(!result.profile)playbackProblem('这首歌暂时无法播放。网易云当前未登录，可先扫码登录后重试。','login');
   }catch{/* Keep the known playback failure when account verification is unavailable. */}
  }
 }else if(track.provider==='apple')playbackProblem('Apple Music 暂时无法播放，请检查账号授权、订阅和网络后重试。','apple');
 else playbackProblem('音频无法读取，请重试，或在曲目中换用 MP3、M4A、WAV 文件。');
}
$('#playback-recover').onclick=()=>{
 const action=playbackFailure?.action;
 if(action==='login'){$('#netease-open').click();return}
 if(action==='apple'){$('#apple-open').click();return}
 play({settleUI:true});
};
$('#playback-dismiss').onclick=()=>{$('#playback-error').hidden=true;playBtn.focus({preventScroll:true})};
function format(t){t=Number.isFinite(t)?Math.max(0,t):0;return Math.floor(t/60).toString().padStart(2,'0')+':'+Math.floor(t%60).toString().padStart(2,'0')}
function playbackUI(){
 const active=!audio.paused&&!audio.ended&&!loading&&!doorOpen;
 if(active){stopped=false;cancelStopFeedback()}
 machine.classList.toggle('stopped',stopped);
 machine.classList.toggle('playing',active);patch.querySelector('svg').innerHTML=icons[audio.paused?'play':'pause'];
 playBtn.setAttribute('aria-label',audio.paused?'播放':'暂停');playBtn.title=audio.paused?'播放（空格）':'暂停（空格）';
 $('#status-text').setAttribute('aria-label',stopped?'已停止，播放进度归零':tracks[current].trial?'试听片段'+(active?'，播放中':'，已暂停'):'播放状态');$('#status-text').textContent=swapping?'SWAP':doorOpen?'OPEN':loading?'LOADING':playbackFailure?'ERROR':stopped?'STOPPED':tracks[current].trial?(active?'TRIAL':'TRIAL Ⅱ'):active?'PLAYING':audio.ended?'ENDED':'PAUSED';
}
function timeUI(){const duration=Number.isFinite(audio.duration)?audio.duration:0;$('#seek').max=duration||1;$('#seek').disabled=!duration||audio.isStation;$('#seek').value=audio.currentTime;$('#seek').style.setProperty('--progress',(duration?audio.currentTime/duration*100:0)+'%');$('#time').textContent=format(audio.currentTime)+' / '+format(duration);$('#seek').setAttribute('aria-valuetext',format(audio.currentTime)+'，共 '+format(duration))}
let rackAssetsTask=null;
function prepareRackAssets({timeoutMs=12000}={}){
 const rack=$('#cassette-rack'),status=$('#rack-load-status');
 if(rack.classList.contains('rack-assets-ready'))return Promise.resolve(true);
 if(rackAssetsTask)return rackAssetsTask;
 status.hidden=false;status.textContent='正在准备磁带架…';status.disabled=true;rack.setAttribute('aria-busy','true');
 rackAssetsTask=(async()=>{
  try{
   const sources=new Set();
   rack.querySelectorAll('[data-src],[data-href]').forEach(el=>{
    if(el.dataset.src){el.src=el.dataset.src;delete el.dataset.src}
    if(el.dataset.href){el.setAttribute('href',el.dataset.href);delete el.dataset.href}
   });
   rack.querySelectorAll('.rack-photo,.music-tag-paper,.rack-nameplate-art image').forEach(el=>sources.add(el.getAttribute('src')||el.getAttribute('href')));
   await Promise.all([...sources].filter(Boolean).map(async src=>{
    const img=new Image();img.src=src;let timer;
    try{await Promise.race([img.decode(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('timeout')),timeoutMs)})])}finally{clearTimeout(timer)}
   }));
   rack.classList.add('rack-assets-ready');status.hidden=true;return true;
  }catch{status.textContent='磁带架加载失败 · 点此重试';status.disabled=false;return false}
  finally{rack.removeAttribute('aria-busy');rackAssetsTask=null}
 })();return rackAssetsTask;
}
$('#rack-load-status').onclick=()=>void prepareRackAssets();
function setBrowsing(open,{revealCurrent=true}={}){
 if(open&&!browsing&&revealCurrent)revealPlayingTape();
 const stage=$('.stage'), before=stage.getBoundingClientRect();stageAnimation?.cancel();
 if(open&&!$('.ensemble').classList.contains('rack-mounted')){
  $('.ensemble').classList.add('rack-mounted');
  // Establish the closed position before entering; keep it mounted for reversible transitions.
  void $('#cassette-rack').offsetWidth;
 }
 if(open)void prepareRackAssets();
 browsing=open;document.body.classList.toggle('browsing',open);$('.ensemble').classList.toggle('is-browsing',open);
 $('#cassette-rack').inert=!open;$('.workspace-tools').inert=!open;$('#shelf-toggle').setAttribute('aria-expanded',String(open));$('#shelf-toggle').setAttribute('aria-label',open?'收起磁带架':'显示磁带架');$('#shelf-toggle').title=open?'回到磁带机':'找一盘磁带';
 if(open)renderRack();
 dx=dy=0;fitMachine();
 if(!reduceMotion.matches){const after=stage.getBoundingClientRect(), tx=(before.x+before.width/2-after.x-after.width/2)/zoom, ty=(before.y+before.height/2-after.y-after.height/2)/zoom, scale=before.width/after.width;
 stageAnimation=stage.animate([{transform:`translate(calc(-50% + ${tx}px),calc(-50% + ${ty}px)) scale(${scale})`},{transform:'translate(-50%,-50%) scale(1)'}],{duration:700,easing:'cubic-bezier(.22,.7,.2,1)'});stageAnimation.finished.then(positionPlayerFeedback,()=>{});}
 if(!open){pullCase(-1);if($('#cassette-rack').contains(document.activeElement)||$('.workspace-tools').contains(document.activeElement))$('#shelf-toggle').focus({preventScroll:true})}
}
$('#shelf-toggle').onclick=()=>{if(!swapping)setBrowsing(!browsing)};
// Only a stationary gesture that starts and ends on the page background returns to listening.
let backgroundPress=null;
const isBrowsingBackground=target=>target instanceof Element&&target.matches('body, main, .ensemble, .stage, .fit');
document.addEventListener('pointerdown',e=>{
 backgroundPress=browsing&&!swapping&&!document.querySelector('dialog[open]')&&e.button===0&&e.isPrimary!==false&&isBrowsingBackground(e.target)?{id:e.pointerId,x:e.clientX,y:e.clientY}:null;
});
document.addEventListener('pointermove',e=>{
 if(backgroundPress&&e.pointerId===backgroundPress.id&&Math.hypot(e.clientX-backgroundPress.x,e.clientY-backgroundPress.y)>6)backgroundPress=null;
});
document.addEventListener('pointerup',e=>{
 const press=backgroundPress;backgroundPress=null;
 if(press&&e.pointerId===press.id&&e.button===0&&Math.hypot(e.clientX-press.x,e.clientY-press.y)<=6&&browsing&&!swapping&&!document.querySelector('dialog[open]')&&isBrowsingBackground(e.target))setBrowsing(false);
});
document.addEventListener('pointercancel',()=>backgroundPress=null);
window.addEventListener('blur',()=>backgroundPress=null);
function setDoor(open,{audible=false}={}){
 cancelStopFeedback();stopped=false;
 if(audible&&open!==doorOpen)keySound(open?'eject':'close');
 doorOpen=open;flipHit.disabled=open||swapping;if(open){requestId++;audio.pause();loading=false}
 machine.classList.toggle('open',open);ejectBtn.setAttribute('aria-label',open?'关闭磁带仓':'打开磁带仓');ejectBtn.setAttribute('aria-pressed',String(open));ejectBtn.title=open?'关闭磁带仓':'打开磁带仓';
 $('#door-close').disabled=!open||swapping;$('#door-close').tabIndex=open&&!swapping?0:-1;playbackUI();
}
function closeLid(){if(swapping)return;cancelSwap();setSwapBusy(true);return finishLoading(swapVersion)}
async function finishLoading(version){
 setDoor(false,{audible:true});$('#ritual-hint').textContent='合上磁带仓…';
 if(!reduceMotion.matches)await new Promise(resolve=>setTimeout(resolve,650));
 if(version!==swapVersion)return;
 setSwapBusy(false);$('#ritual-hint').textContent='';playBtn.focus({preventScroll:true});await play({settleUI:true});
}
function setSwapBusy(value){flipHit.disabled=value||doorOpen;swapping=value;$('#shelf-toggle').disabled=value;machine.classList.toggle('swapping',value);playBtn.disabled=ejectBtn.disabled=value;$('#door-close').disabled=!doorOpen||value;$('#door-close').tabIndex=doorOpen&&!value?0:-1;document.querySelectorAll('.case').forEach(b=>b.disabled=value);playbackUI()}
function cancelSwap(){swapVersion++;swapAnimations.forEach(a=>a.cancel());swapAnimations.clear();setSwapBusy(false);$('#ritual-hint').textContent=''}
async function moveCassette(frames,duration){if(reduceMotion.matches)return;const a=cassette.animate(frames,{duration,easing:'cubic-bezier(.22,.7,.2,1)',fill:'forwards'});swapAnimations.add(a);try{await a.finished}catch{}finally{a.cancel();swapAnimations.delete(a)}}
async function beginSwap(index){
 setBrowsing(true,{revealCurrent:false});pullCase(-1);cancelSwap();const version=swapVersion;setSwapBusy(true);const wasOpen=doorOpen;setDoor(true,{audible:true});$('#ritual-hint').textContent='打开磁带仓…';
 if(!wasOpen&&!reduceMotion.matches)await new Promise(resolve=>setTimeout(resolve,650));if(version!==swapVersion)return;
 $('#ritual-hint').textContent='取出旧磁带…';
 await moveCassette([{transform:'translate(0,0) scale(1)',opacity:1},{transform:'translate(0,-24px) scale(1.035)',opacity:1,offset:.4},{transform:'translate(180px,-90px) scale(.55) rotate(6deg)',opacity:0}],580);if(version!==swapVersion)return;
 selectTrack(index,false,{ritual:true});$('#ritual-hint').textContent='正在装入磁带…';
 await moveCassette([{transform:'translate(180px,-90px) scale(.55) rotate(-6deg)',opacity:0},{transform:'translate(0,-24px) scale(1.035)',opacity:1,offset:.65},{transform:'translate(0,0) scale(1)',opacity:1}],650);if(version!==swapVersion)return;
 await finishLoading(version);
}
function pullCase(index){
 pulled=index;document.querySelectorAll('.case').forEach(b=>{const i=Number(b.dataset.index);b.classList.toggle('pulled',i===index);b.setAttribute('aria-pressed',String(i===index));b.setAttribute('aria-label',(i===index?'装入 ':'抽出 ')+tracks[i].title+' 磁带盒')});
 $('#rack-hint').textContent=index<0?'点一下抽出 · 再点装入':'再点装入 · 点击别处放回';
 renderBooklet();
}
const tagSizeObserver=new ResizeObserver(entries=>{for(const entry of entries){entry.target.style.setProperty('--tag-scale',entry.contentRect.width/648);alignRackGroup()}});tagSizeObserver.observe($('#tape-booklet'));
// Share cover decoding between the player, six spines and the selected paper.
const coverLoads=new Map();let bookletArtworkVersion=0;
function loadCoverImage(src){
 if(coverLoads.has(src))return coverLoads.get(src);
 const job=(async()=>{
  for(let attempt=0;attempt<2;attempt++){
   const img=new Image();if(new URL(src,location.href).origin!==location.origin)img.crossOrigin='anonymous';img.src=src;
   try{await img.decode();return img}catch(error){if(attempt)throw error;await new Promise(resolve=>setTimeout(resolve,600))}
  }
 })();coverLoads.set(src,job);
 job.catch(()=>{if(coverLoads.get(src)===job)coverLoads.delete(src)});
 if(coverLoads.size>48)coverLoads.delete(coverLoads.keys().next().value);
 return job;
}
function renderBooklet(){
 const tag=$('#tape-booklet'),track=tracks[pulled],visible=!!track&&!swapping;
 tag.classList.toggle('is-visible',visible);tag.inert=!visible;tag.setAttribute('aria-hidden',String(!visible));
 if(!visible){bookletArtworkVersion++;delete $('#booklet-art').dataset.cover;return}
 const art=$('#booklet-art'),cover=track.cover;
 if(art.dataset.cover!==cover){
  const version=++bookletArtworkVersion;art.dataset.cover=cover;delete art.dataset.src;art.hidden=true;art.removeAttribute('src');
  if(cover&&cover!=='assets/cover-unavailable.svg')void loadCoverImage(cover).then(()=>{
   if(version!==bookletArtworkVersion||tracks[pulled]!==track||track.cover!==cover)return;
   art.src=cover;art.hidden=false;
  }).catch(()=>{if(version===bookletArtworkVersion)delete art.dataset.cover});
 }
 $('#booklet-title').textContent=track.title;
 $('#booklet-artist').textContent=track.artist||'—';$('#booklet-album').textContent=track.album||'—';
 $('#booklet-number').textContent=String(pulled+1).padStart(2,'0');
}
// A fixed physical rack is a window onto the full playlist, not a capacity limit.
function rackWindowOffset(){return Math.max(0,Math.min(Math.floor(rackStore?.rack().scroll||0),Math.max(0,rackViewRows.length-6)))}
function updateRackPosition(){
 if(rackStore){const count=rackViewRows.length,offset=rackWindowOffset();$('#rack-navigation').hidden=count<=6;$('#rack-back').disabled=offset===0;$('#rack-forward').disabled=offset+6>=count;$('#rack-range').textContent=(count?offset+1:0)+'–'+Math.min(count,offset+6);$('#rack-range').setAttribute('aria-label','当前显示第 '+(count?offset+1:0)+' 至 '+Math.min(count,offset+6)+' 盘，共 '+count+' 盘');return;}
 const slots=$('#rack-slots'),max=Math.max(0,slots.scrollHeight-slots.clientHeight),more=max>1;
 $('#rack-navigation').hidden=!more;
 $('#rack-back').disabled=slots.scrollTop<1;
 $('#rack-forward').disabled=slots.scrollTop>=max-1;
 const view=slots.getBoundingClientRect(),shown=[...slots.querySelectorAll('.case')].filter(b=>{const rect=b.getBoundingClientRect();return rect.bottom>view.top&&rect.top<view.bottom});
 const first=shown.length?Number(shown[0].dataset.index)+1:1;
 const last=shown.length?Number(shown[shown.length-1].dataset.index)+1:Math.min(tracks.length,6);
 $('#rack-range').textContent=first+'–'+last;
 $('#rack-range').setAttribute('aria-label','当前显示第 '+first+' 至 '+last+' 盘，共 '+tracks.length+' 盘');
}
function browseRack(direction){
 if(rackStore){const r=rackStore.rack(),offset=rackWindowOffset(),next=Math.max(0,Math.min(Math.max(0,rackViewRows.length-6),offset+Math.sign(direction)));if(next===offset)return;pullCase(-1);rackStore.change(s=>{s.racks.find(x=>x.id===r.id).scroll=next});renderRack();animateRackChange($('#rack-slots'),'Y',direction);return;}
 const slots=$('#rack-slots'),rows=Number(getComputedStyle(slots).getPropertyValue('--rack-rows'))||6;
 pullCase(-1);
 // Keep one row in common so each movement retains a visual reference.
 const step=parseFloat(getComputedStyle(slots).getPropertyValue('--rack-step'))||42;
 slots.scrollBy({top:direction*(rows-1)*step,behavior:reduceMotion.matches?'instant':'smooth'});
}
$('#rack-back').onclick=()=>browseRack(-1);
$('#rack-forward').onclick=()=>browseRack(1);
$('#rack-slots').addEventListener('scroll',()=>{updateRackPosition();updateRackProjections()},{passive:true});
new ResizeObserver(updateRackPosition).observe($('#rack-slots'));
function updateRackProjections(){
 const rack=$('.rack'),photo=$('.rack-photo'),scale=photo.clientWidth/1024;if(!scale)return;
 for(const b of rack.querySelectorAll('.case')){
  const style=getComputedStyle(b),seatX=parseFloat(style.getPropertyValue('--case-seat-x'))||0,seatY=parseFloat(style.getPropertyValue('--case-seat-y'))||0;
  let x=seatX,y=seatY,node=b;
  while(node&&node!==rack){x+=node.offsetLeft;y+=node.offsetTop;const parent=node.offsetParent;if(parent){x-=parent.scrollLeft;y-=parent.scrollTop}node=parent}
  const w=parseFloat(style.width),h=parseFloat(style.height);if(!w||!h)continue;
  const projection=projectRackCase(x,y,w,h,scale);
  b.dataset.projectionVisible=String(!!projection);
  if(!projection){for(const key of ['--case-front-projection','--case-top-projection','--case-side-projection'])b.style.removeProperty(key);continue}
  b.style.setProperty('--case-front-projection',projection.frontMatrix);b.style.setProperty('--case-top-projection',projection.topMatrix);b.style.setProperty('--case-side-projection',projection.sideMatrix);b.style.setProperty('--case-surface-depth',projection.surfaceDepth+'px');
  b.style.setProperty('--case-pull-x',(seatX+projection.pull[0])+'px');b.style.setProperty('--case-pull-y',(seatY+projection.pull[1])+'px');
 }
}
const spineSizeObserver=new ResizeObserver(entries=>{for(const {target,contentRect} of entries)target.style.setProperty('--spine-scale',contentRect.width/616);updateRackProjections()});
// Map live text to the four corners of the approved paper front, in cropped artwork coordinates.
function alignRackNameplate(){
 const label=$('.rack-nameplate'),scale=label.clientWidth/1390;
 const face=[[92,6],[1288,18],[1228,473],[4,453]].map(p=>p.map(n=>n*scale));
 $('.rack-nameplate-front').style.transform=quadCSSMatrix(face,300,110);
}
new ResizeObserver(alignRackNameplate).observe($('.rack-nameplate'));
function renderRack(){
 const rackTitle=rackStore?rackStore.rack().name:'My Mix';rackViewRows=visibleRackRows();
 $('#rack-nameplate-title').textContent=rackTitle;$('#rack-nameplate-title').title=rackTitle;
 fitRackName();
 spineSizeObserver.disconnect();
 const slots=$('#rack-slots'),position=slots.scrollTop;slots.replaceChildren();slots.classList.toggle('scrollable',false);
 const offset=rackWindowOffset();
 rackViewRows.slice(offset,offset+6).forEach(({t,index:i,state},row)=>{const slot=document.createElement('div');slot.className='rack-slot';const b=document.createElement('button');b.className='case';b.dataset.index=i;b.dataset.row=offset+row;b.dataset.queueState=state||'saved';b.dataset.variant=t.variant;b.setAttribute('aria-current',String(i===current));b.disabled=swapping;
 t.spineStyle ||= cassetteSpineStyle(t.provider?t.provider+':'+t.id:t.title);b.dataset.spineStyle=t.spineStyle;b.dataset.edition=t.edition||'';
 const top=document.createElement('i');top.className='case-top';top.setAttribute('aria-hidden','true');const side=document.createElement('i');side.className='case-side';side.setAttribute('aria-hidden','true');
 top.innerHTML='<span class="case-lid-seam"></span><span class="case-lid-rail left"></span><span class="case-lid-rail right"></span>';
 side.innerHTML='<span class="case-split"></span><span class="case-hinge"></span><span class="case-catch"></span>';
 const surface=document.createElement('span');surface.className='spine-surface';
 const canvas=document.createElement('span');canvas.className='spine-canvas';
 const paper=document.createElement('span');paper.className='spine-paper';
 const cover=new Image();cover.alt='';cover.className='spine-art';cover.hidden=true;
 if(browsing&&t.cover&&t.cover!=='assets/cover-unavailable.svg'){
  const src=t.cover;void loadCoverImage(src).then(()=>{if(t.cover===src){cover.src=src;cover.hidden=false}}).catch(()=>{});
  if((!t.coverInfo||!t.coverInfo.valid&&Date.now()>=(t.coverInfo.retryAfter||0))&&!t.coverPending){t.coverPending=true;void matchTrackPlastic(t).finally(()=>t.coverPending=false)}
 }
 const copy=document.createElement('span');copy.className='spine-copy';const title=document.createElement('span');title.className='case-name';title.textContent=t.title;
 const detail=document.createElement('span');detail.className='spine-detail';detail.textContent=[t.artist,t.album].filter(Boolean).join(' · ')||(t.provider==='apple'?'APPLE MUSIC':t.provider==='netease'?'NETEASE MUSIC':t.local?'LOCAL AUDIO':'ORIGINAL DEMO');copy.append(title,detail);
 const catalog=document.createElement('span');catalog.className='spine-catalog';catalog.setAttribute('aria-hidden','true');const number=document.createElement('span');number.textContent=String(offset+row+1).padStart(3,'0');const format=document.createElement('span');format.textContent='CASSETTE';catalog.append(number,format);
 paper.append(cover,copy,catalog);canvas.append(paper);surface.append(canvas);const frame=document.createElement('span');frame.className='spine-frame';frame.setAttribute('aria-hidden','true');surface.append(frame);b.append(top,side,surface);spineSizeObserver.observe(b);
 b.onclick=()=>{if(swapping)return;if(pulled===i){choosePlaybackRack();beginSwap(i)}else pullCase(i)};slot.append(b);slots.append(slot)});
 for(let i=Math.min(6,rackViewRows.length-offset);i<6;i++){const blank=document.createElement('div');blank.className='rack-slot empty';blank.setAttribute('aria-hidden','true');slots.append(blank)}
 $('#rack-count').textContent=String(rackViewRows.length).padStart(2,'0')+' TAPES';pullCase(pulled);slots.scrollTop=position;updateRackPosition();requestAnimationFrame(updateRackProjections);applyPlasticUI();refreshRackControls();
}
document.addEventListener('pointerdown',e=>{if(pulled>=0&&!e.target.closest('.case, #tape-booklet'))pullCase(-1)});
document.addEventListener('focusin',e=>{if(pulled>=0&&!e.target.closest('.case, #tape-booklet'))pullCase(-1)});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&pulled>=0&&!document.querySelector('dialog[open]')){const returnFocus=$('#tape-booklet').contains(document.activeElement)?document.querySelector(`.case[data-index="${pulled}"]`):null;pullCase(-1);if(returnFocus)returnFocus.focus({preventScroll:true});e.preventDefault()}});
$('#door-close').onclick=closeLid;
$('#door').onclick=e=>{if(doorOpen&&!swapping&&!e.target.closest('#door-close'))closeLid()};
async function play({settleUI=false}={}){
 cancelStopFeedback();stopped=false;
 if(swapping)return;if(doorOpen)return closeLid();const id=++requestId,track=tracks[current];
 clearPlaybackFailure();loading=true;playbackUI();watchPlayback(id,track);document.dispatchEvent(new Event('cassette-playbackrequest'));
 try{
  if(track.provider==='netease'&&(!track.src||Date.now()>=(track.streamExpires||0))){
   loading=true;playbackUI();const result=await neteaseRequest('stream',{id:track.id});
   if(id!==requestId||track!==tracks[current]||doorOpen)return;
   const position=audio.currentTime||0;track.src=result.url;track.streamExpires=result.expiresAt-30000;track.trial=result.trial;audio.src=track.src;audio.load();
   if(position)audio.addEventListener('loadedmetadata',()=>{if(id===requestId&&Number.isFinite(audio.duration))audio.currentTime=Math.min(position,audio.duration)},{once:true});
   $('#source-note').textContent='网易云音乐'+(track.trial?' · 当前为试听片段':'');
   if(track.trial)notice('这首歌当前为试听片段，完整播放需满足网易云账号权限。');
  }
  if(id!==requestId)return;await audio.play();if(id===requestId&&!audio.paused){loading=false;playbackUI()}if(settleUI&&id===requestId&&!audio.paused&&!document.querySelector('dialog[open]'))setBrowsing(false);
 }catch(error){await reportPlaybackFailure(error,id,track)}
}
const buttonSounds=new Map([['play',$('#play-sound')]]);
for(const name of ['pause','stop','prev','next','like-on','like-off','mode','eject','close']){
 const sound=document.createElement('audio');sound.id='sfx-'+name;sound.src='assets/key-'+name+'.wav';sound.preload='auto';sound.hidden=true;document.body.append(sound);buttonSounds.set(name,sound);
}
let activeKeySound;
function keySound(name){
 const sound=buttonSounds.get(name);if(!sound)return;
 try{activeKeySound?.pause();sound.pause();sound.currentTime=0;sound.volume=audio.muted?0:audio.volume*.45;if(sound.volume>0){activeKeySound=sound;sound.play()?.catch(()=>{})}}catch{}
}
function playKeySound(){keySound('play')}
function togglePlay(){if(swapping)return;if(loading){keySound('pause');requestId++;loading=false;audio.pause();playbackUI()}else if(audio.paused){playKeySound();play({settleUI:true})}else{keySound('pause');requestId++;audio.pause()}}
function renderTracks(){const list=$('#track-list');list.replaceChildren();visibleRackRows().slice(0,30).forEach(({t,index:i})=>{const b=document.createElement('button');b.className='track';b.setAttribute('aria-current',String(i===current));b.setAttribute('aria-label','装入 '+t.title);const img=new Image();img.loading='lazy';img.fetchPriority='low';img.src=t.cover;img.alt='';const name=document.createElement('span');name.textContent=t.title;const tag=document.createElement('small');tag.textContent=[t.artist,t.album].filter(Boolean).join(' · ')||(t.provider==='apple'?'Apple Music':t.provider==='netease'?'网易云音乐':t.local?'本地音乐':'原创示例');b.append(img,name,tag);b.onclick=()=>{choosePlaybackRack();closeModal($('#library'));beginSwap(i)};list.append(b)});$('#track-count').textContent=String(visibleRackRows().length).padStart(2,'0');renderRack()}
function applyPlasticUI(){
 const t=tracks[current],plastic=plasticPalette.find(p=>p.id===t.plastic?.id)||plasticPalette[1];
 machine.style.setProperty('--accent',plastic.color);
 // Colour the photographic shell itself; keep the cover and moving hubs untouched.
 shell.dataset.plastic=plastic.id;shell.querySelector('img').style.filter=plastic.shellFilter;
 $('#plastic-name').textContent=plastic.name;$('#plastic-swatch').style.backgroundColor=plastic.color;
 document.querySelectorAll('.case').forEach(b=>{const i=Number(b.dataset.index);const color=(tracks[i].plastic||plasticPalette[1]).color;b.style.setProperty('--case-plastic',color);b.style.setProperty('--case-cover',`url("${tracks[i].cover}")`);b.style.setProperty('--spine-colour',color)});
 renderBooklet();
}
function cacheCoverInfo(track,img,cover=track.cover){
 track.coverInfo={src:cover,valid:true,width:img.naturalWidth,height:img.naturalHeight,inks:cassetteCoverInks(img)};
 track.plastic=plasticFromImage(img);track.color=track.plastic.color;
}
function renderCoverTreatment(){
 const track=tracks[current],info=track.coverInfo?.src===track.cover?track.coverInfo:null;
 const scale=(fit.clientWidth||750)/750*zoom;
 const mode=cassetteCoverMode(info,label.offsetWidth*scale,label.offsetHeight*scale,window.devicePixelRatio||1);
 track.printStyle ||= cassettePrintStyle(track.title);dynamic.dataset.printStyle=track.printStyle;dynamic.dataset.edition=track.edition||'';
 printDetails.querySelector('.print-footer').textContent=track.edition==='neon'?'CITY POP · NEON NIGHT':'COMPACT CASSETTE';
 sideMark.textContent=cassetteSide;dynamic.dataset.coverMode=mode;dynamic.style.display='block';label.querySelector('img').style.visibility='hidden';
 customTitle.textContent=track.title;artistLine.textContent=[track.artist,track.album].filter(Boolean).join(' · ');
 dynamic.style.setProperty('--paper-tint',track.plastic?.color||'#687276');
 for(const region of ['top','bottom']){
  const ink=info?.inks?.[region]||'#ffffff';dynamic.style.setProperty('--cover-'+region+'-ink',ink);
  dynamic.style.setProperty('--cover-'+region+'-edge',ink==='#ffffff'?'#000b':'#fffd');
 }
 dynamic.style.backgroundImage=mode==='full'?`url("${track.cover}")`:'url("assets/cassette-label-paper.1b8ae731eb42.webp")';
 thumb.hidden=mode!=='tinted';thumb.style.display=mode==='tinted'?'block':'none';
 if(mode==='tinted')thumb.src=track.cover;else thumb.removeAttribute('src');
}
async function matchTrackPlastic(track){
 const cover=track.cover;
 if(!cover||cover==='assets/cover-unavailable.svg'){track.coverInfo={src:cover,valid:false};if(track===tracks[current])renderCoverTreatment();return}
 let img;
 try{img=await loadCoverImage(cover)}catch{if(track.cover===cover){track.coverInfo={src:cover,valid:false,retryAfter:Date.now()+5000};if(track===tracks[current])renderCoverTreatment()}return}
 if(track.cover!==cover)return;
 cacheCoverInfo(track,img,cover);applyPlasticUI();if(track===tracks[current])renderCoverTreatment();
}
function updateCoverSource(track){
 const link=$('#cover-source-link');let url='',service='';
 if(track.provider==='netease'&&/^[1-9]\d*$/.test(String(track.id))){url='https://music.163.com/song?id='+encodeURIComponent(track.id);service='网易云音乐'}
 if(track.provider==='apple'){service='Apple Music';if(/^https:\/\/music\.apple\.com\//.test(track.sourceURL||''))url=track.sourceURL;else if(!track.library)url='https://music.apple.com/song/'+encodeURIComponent(track.id)}
 link.hidden=!url;
 if(url){link.href=url;link.textContent='在 '+service+' 打开 ↗';link.setAttribute('aria-label','在 '+service+' 打开《'+track.title+'》')}
 else{link.removeAttribute('href');link.removeAttribute('aria-label')}
}
function artUI(){renderBackDetails();const t=tracks[current], forest=t.variant==='forest';updateCoverSource(t);label.querySelector('img').src=forest?'assets/album-label-forest.f7c07bdec378.webp':'assets/album-label.f038d7dc76ca.webp';shell.querySelector('img').src='assets/cassette-shell.3d71f41337e9.webp';
 renderCoverTreatment();
 $('#track-name').textContent=t.title;$('#track-name').title=t.title;$('#cover-title').textContent=t.title;$('#large-cover').src=t.cover;$('#cover-description').textContent=t.description;$('#source-note').textContent=t.provider==='apple'?(t.station?'Apple Music · '+t.stationName:'Apple Music · 音乐由 Apple Music 提供'):t.provider==='netease'?'网易云音乐'+(t.trial?' · 当前为试听片段':''):t.local?'本地音乐 · 仅在此浏览器中播放':'原创演示曲 · 从曲目中连接网易云 / Apple Music';
 if(!reduceMotion.matches)label.animate([{opacity:.25},{opacity:1}],{duration:320,easing:'ease-out'});renderTracks();
}
function selectTrack(index,autoplay=!audio.paused,{ritual=false,keepHistory=false}={}){clearPlaybackWatch();clearPlaybackFailure();cancelStopFeedback();stopped=false;if(!keepHistory)randomHistory=[];if(!ritual){cancelSwap();pullCase(-1);if(doorOpen)setDoor(false)}requestId++;audio.pause();loading=false;current=(index+tracks.length)%tracks.length;audio.use(tracks[current]);setCassetteSide('A');if(tracks[current].src)audio.src=tracks[current].src;else audio.removeAttribute('src');audio.load();artUI();if(tracks[current].provider&&!tracks[current].coverInfo?.valid)matchTrackPlastic(tracks[current]);timeUI();playbackUI();document.dispatchEvent(new Event('cassette-trackchange'));if(autoplay)play()}
audio.addEventListener('stationitemchange',()=>{
 const track=tracks[current];if(track!==audio.track||!track.station)return;
 const song=track.radioSong;
 Object.assign(track,{title:song?.title||track.stationName,artist:song?.artist||'Apple Music',album:song?.album||'我的电台',year:song?.year||'',cover:song?.cover||track.stationCover,duration:song?.duration||0});
 track.coverInfo=null;artUI();void matchTrackPlastic(track);timeUI();document.dispatchEvent(new Event('cassette-trackchange'));
});
function advanceTrack(direction=1,autoplay=swapping||loading||!audio.paused,{ended=false}={}){
 if(audio.isStation){if(ended){audio.queued='';loading=false;playbackUI();notice('电台播放已结束，点播放可继续收听。');return}if(direction<0){notice('个人电台不支持上一首。');return}if(loading)return;const track=tracks[current];loading=true;playbackUI();audio.skipStation().catch(()=>{if(track===tracks[current])notice('暂时无法切换电台歌曲，请稍后重试。')}).finally(()=>{if(track===tracks[current]){loading=false;playbackUI()}});return}
 const available=(playbackKeys.length?playbackKeys:[rackTrackKey(tracks[current])]).map(key=>trackIndexForKey(key)).filter(i=>i>=0);if(!available.includes(current))available.unshift(current);
 let index=current;
 if(ended&&playbackMode==='single')index=current;
 else if(playbackMode==='random'){
  if(direction<0){while(randomHistory.length){const previous=randomHistory.pop();if(available.includes(previous)){index=previous;break}}}
  else{const pool=available.filter(i=>i!==current);index=pool.length?pool[Math.floor(Math.random()*pool.length)]:available[0];if(index!==current){randomHistory.push(current);if(randomHistory.length>200)randomHistory.shift()}}
 }else{const position=available.indexOf(current);index=available[(position+direction+available.length)%available.length]}
 selectTrack(index,autoplay,{keepHistory:true});
}
function cancelStopFeedback(){
 stopEffects.version++;cancelAnimationFrame(stopEffects.frame);stopEffects.frame=0;
 stopEffects.animations.forEach(animation=>animation.cancel());stopEffects.animations.clear();
 stopEffects.fire?.reset();stopEffects.fire=null;stopEffects.canvas?.remove();stopEffects.canvas=null;
}
function animateStopPart(element,frames,options){
 const animation=element.animate(frames,options);stopEffects.animations.add(animation);
 animation.finished.then(()=>{animation.cancel();stopEffects.animations.delete(animation)},()=>{});
}
async function prepareStopPaper(){
 if(typeof OffscreenCanvas==='undefined'||typeof DOMMatrix==='undefined')return false;
 const atlas=new Image();atlas.fetchPriority='low';atlas.src='assets/stop-metal-atlas-v3.png';
 await atlas.decode();
 // Measured alpha bounds in the generated 1774 x 887 metallic foil atlas.
 // Preserve mirror highlights and dark reflections when resampling the sprites.
 const crops=[[[84,51,284,273],[522,59,282,279],[998,64,257,268],[1429,54,275,268]],[[142,361,166,496],[586,361,176,498],[1030,358,158,499],[1472,357,161,486]]];
 const paper=[],ribbon=[];
 for(let row=0;row<2;row++)for(const [x,y,width,height] of crops[row]){
  const longest=row?112:64,ratio=longest/Math.max(width,height),w=Math.round(width*ratio),h=Math.round(height*ratio);
  const surface=new OffscreenCanvas(w,h),ctx=surface.getContext('2d');if(!ctx)return false;
  ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(atlas,x,y,width,height,0,0,w,h);
  // Bitmap shape contract from the locally pinned canvas-confetti 1.9.4.
  const size=row ? .22 : .2;
  (row?ribbon:paper).push({type:'bitmap',bitmap:surface.transferToImageBitmap(),matrix:[size,0,0,size,-w*size/2,-h*size/2]});
 }
 stopEffects.papers={paper,ribbon};return true;
}
function burstStopPaper(){
 if(typeof window.confetti!=='function'||!stopEffects.papers)return;
 const rect=stopBtn.getBoundingClientRect(),scale=Math.min(1.15,Math.max(.5,machine.getBoundingClientRect().width/750)),pixels=Math.min(2,devicePixelRatio||1);
 const canvas=document.createElement('canvas');canvas.className='stop-confetti';canvas.width=Math.round(innerWidth*pixels);canvas.height=Math.round(innerHeight*pixels);canvas.setAttribute('aria-hidden','true');document.body.append(canvas);stopEffects.canvas=canvas;
 const fire=window.confetti.create(canvas,{resize:false,useWorker:false,disableForReducedMotion:true});stopEffects.fire=fire;
 const shapes=stopEffects.papers,version=stopEffects.version;
 const common={origin:{x:(rect.left+rect.width/2)/innerWidth,y:(rect.top+rect.height*.4)/innerHeight},angle:90,spread:100,startVelocity:20*scale*pixels,decay:.9,gravity:1.15*scale*pixels,ticks:48,scalar:scale*pixels,colors:['#e8edf0','#c8a65e','#a9bbc8','#c9bdd5'],disableForReducedMotion:true};
 fire({...common,particleCount:24,shapes:shapes.paper});
 const finished=fire({...common,particleCount:8,spread:80,startVelocity:23*scale*pixels,shapes:shapes.ribbon});
 Promise.resolve(finished).then(()=>{if(version===stopEffects.version){canvas.remove();stopEffects.canvas=null;stopEffects.fire=null}});
}
function stopPlayback(){
 clearPlaybackWatch();clearPlaybackFailure();
 const wasPlaying=machine.classList.contains('playing'),lamp=$('.status i');
 let spindles=[],light;
 // Capture appearance only. Feedback must never gate the actual stop command.
 try{if(!reduceMotion.matches){light={backgroundColor:getComputedStyle(lamp).backgroundColor,boxShadow:getComputedStyle(lamp).boxShadow};if(wasPlaying)spindles=[...reelWell.querySelectorAll('.rotor')].flatMap(hub=>hub.getAnimations().filter(a=>a.animationName==='spin').map(animation=>({animation,from:Number(animation.currentTime)||0})))}}catch{}
 cancelStopFeedback();keySound('stop');requestId++;stopped=true;
 audio.pause();audio.currentTime=0;loading=false;cancelSwap();timeUI();playbackUI();
 if(reduceMotion.matches||document.hidden)return;
 try{
  animateStopPart(stopCap,[{transform:'translateY(0)'},{transform:'translateY(2.3px)',offset:.35},{transform:'translateY(0)'}],{duration:150,easing:'ease-out'});
  if(wasPlaying){
   const start=performance.now(),version=stopEffects.version;
   const coast=now=>{if(version!==stopEffects.version)return;const t=Math.min(1,Math.max(0,(now-start)/350));for(const {animation,from} of spindles)animation.currentTime=from+350*(t-t*t/2);stopEffects.frame=t<1?requestAnimationFrame(coast):0};
   stopEffects.frame=requestAnimationFrame(coast);
   animateStopPart(lamp,[light,{backgroundColor:'#2b302c',boxShadow:'0 0 0 #ffba3f00'}],{delay:350,duration:550,easing:'ease-out',fill:'both'});
  }
  burstStopPaper();
 }catch{cancelStopFeedback()}
}
stopEffects.paperReady=prepareStopPaper().catch(()=>false);
reduceMotion.addEventListener('change',()=>{if(reduceMotion.matches)cancelStopFeedback()});
document.addEventListener('visibilitychange',()=>{if(document.hidden)cancelStopFeedback()});
window.addEventListener('pagehide',cancelStopFeedback);
window.addEventListener('resize',cancelStopFeedback);
playBtn.onclick=togglePlay;layers.get('button-prev').onclick=()=>{keySound('prev');advanceTrack(-1)};layers.get('button-next').onclick=()=>{keySound('next');advanceTrack(1)};
stopBtn.onclick=stopPlayback;ejectBtn.onclick=()=>{if(doorOpen)closeLid();else{setBrowsing(true);setDoor(true,{audible:true});$('#ritual-hint').textContent='选一盘磁带自动装入，或按播放合盖继续'}};
for(const event of ['play','pause','ended'])audio.addEventListener(event,playbackUI);
audio.addEventListener('waiting',()=>{loading=!audio.paused;playbackUI()});audio.addEventListener('playing',()=>{loading=false;clearPlaybackFailure();watchPlayback();playbackUI()});audio.addEventListener('canplay',()=>{loading=false;playbackUI()});
for(const event of ['timeupdate','loadedmetadata','durationchange'])audio.addEventListener(event,()=>{timeUI();if(event!=='timeupdate')renderBackDetails()});
audio.addEventListener('pause',clearPlaybackWatch);
audio.addEventListener('timeupdate',()=>{if(!audio.paused&&!audio.ended&&Math.abs((audio.currentTime||0)-playbackLastPosition)>.05)watchPlayback()});
audio.addEventListener('error',()=>{reportPlaybackFailure({name:'NotSupportedError',mediaError:true},requestId,tracks[current])});audio.addEventListener('ended',()=>advanceTrack(1,true,{ended:true}));
$('#seek').oninput=e=>{if(Number.isFinite(audio.duration)){audio.currentTime=Number(e.target.value);timeUI()}};
const volumeScale=$('.volume-scale'),volumePointers=new Set();let volumeKeyboard=false;
function renderVolumeScale(){volumeScale.classList.toggle('is-active',volumePointers.size>0||(volumeKeyboard&&document.activeElement===$('#volume-fader')))}
document.addEventListener('pointerdown',()=>{volumeKeyboard=false;renderVolumeScale()},{capture:true});
for(const id of ['volume-wheel','volume-fader'])$('#'+id).addEventListener('pointerdown',e=>{if(e.button!==0)return;volumePointers.add(e.pointerId);renderVolumeScale()});
for(const event of ['pointerup','pointercancel'])document.addEventListener(event,e=>{volumePointers.delete(e.pointerId);renderVolumeScale()},{capture:true});
document.addEventListener('keydown',e=>{if(e.key==='Tab'||(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Home','End','PageUp','PageDown'].includes(e.key)&&e.target===$('#volume-fader'))){volumeKeyboard=true;renderVolumeScale()}},{capture:true});
$('#volume-fader').addEventListener('focus',renderVolumeScale);
$('#volume-fader').addEventListener('blur',()=>{volumeKeyboard=false;renderVolumeScale()});
function dismissVolumeScale(){volumePointers.clear();volumeKeyboard=false;renderVolumeScale()}
window.addEventListener('blur',dismissVolumeScale);
document.addEventListener('visibilitychange',()=>{if(document.hidden)dismissVolumeScale()});
function setVolume(value){value=Math.min(100,Math.max(0,Math.round(value)));audio.volume=value/100;turnVolumeWheel(value);for(const id of ['volume','volume-wheel','volume-fader']){const control=$('#'+id);control.value=value;control.setAttribute('aria-valuetext',value+'%')}$('#volume-reading').textContent=String(value)}
for(const id of ['volume','volume-wheel','volume-fader'])$('#'+id).oninput=e=>setVolume(e.target.value);
$('#volume-wheel').addEventListener('wheel',e=>{e.preventDefault();setVolume(audio.volume*100+(e.deltaY<0?3:-3))},{passive:false});setVolume(60);
function alignRackGroup(){
 // Reserve the tag even when hidden, so selecting a tape never shifts the rack.
 const b=geometry.find(layer=>layer.id==='chassis').b,scale=fit.clientWidth/750;
 const tagGap=parseFloat(getComputedStyle($('#cassette-rack')).getPropertyValue('--rack-name-clearance'))||12;
 const offset=($('#tape-booklet').offsetHeight+tagGap)/2+(b.y+b.height/2-250)*scale;
 $('#cassette-rack').style.setProperty('--rack-align-y',offset+'px');
}
function fitMachine(){requestAnimationFrame(positionPlayerFeedback);const s=fit.clientWidth/750;machine.style.transform=`scale(${s})`;machine.style.left='0px';machine.style.top='0px';$('.ensemble').style.transform=`translate(${dx}px,${dy}px) scale(${zoom})`;$('#size').setAttribute('aria-valuetext',$('#size').value+'%');renderCoverTreatment();alignRackGroup()}
new ResizeObserver(()=>{dx=dy=0;fitMachine()}).observe(fit);fitMachine();
$('#size').oninput=e=>{zoom=Number(e.target.value)/70*1.1;fitMachine()};$('#position-reset').onclick=()=>{dx=dy=0;zoom=1.1;$('#size').value=70;fitMachine()};
const drag=$('.drag-zone');let dragState;
drag.onpointerdown=e=>{if(e.button!==0)return;dragState={x:e.clientX,y:e.clientY,dx,dy};drag.setPointerCapture(e.pointerId)};
drag.onpointermove=e=>{if(!dragState)return;const margin=Math.max(0,(fit.clientWidth-fit.clientWidth*.86*zoom)/2-8);dx=Math.max(-margin,Math.min(margin,dragState.dx+e.clientX-dragState.x));dy=Math.max(-90,Math.min(70,dragState.dy+e.clientY-dragState.y));fitMachine()};drag.onpointerup=drag.onpointercancel=()=>dragState=null;
const modalTimers=new Map(),modalFrames=new Map();
// Playback events (including automatic track changes and radio) never navigate the UI.
function refreshToolState(){for(const [id,dialogs] of [['library-open',['library','netease','apple-music']],['appearance-open',['appearance']],['help-open',['help']]])$('#'+id).setAttribute('aria-expanded',String(dialogs.some(name=>$('#'+name).open&&!$('#'+name).classList.contains('is-closing'))))}
function openModal(d){
 clearTimeout(modalTimers.get(d));cancelAnimationFrame(modalFrames.get(d));d.classList.remove('is-closing');
 if(!d.open){d.classList.remove('is-open');d.showModal();void d.offsetWidth}
 refreshToolState();modalFrames.set(d,requestAnimationFrame(()=>{modalFrames.delete(d);if(d.open&&!d.classList.contains('is-closing'))d.classList.add('is-open')}));
}
function closeModal(d){cancelAnimationFrame(modalFrames.get(d));modalFrames.delete(d);d.classList.remove('is-open');d.classList.add('is-closing');refreshToolState();const ms=reduceMotion.matches?0:parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--modal-close-dur'))||150;modalTimers.set(d,setTimeout(()=>{d.close();d.classList.remove('is-closing')},ms))}
function setMusicShortcutSelection(dialog,selectedId=''){for(const button of dialog.querySelectorAll('.cloud-shortcuts button'))button.setAttribute('aria-pressed',String(button.id===selectedId))}
let libraryReturnScroll=0;
function openMusicProvider(d){const library=$('#library');libraryReturnScroll=library.scrollTop;clearTimeout(modalTimers.get(library));cancelAnimationFrame(modalFrames.get(library));library.close();library.classList.remove('is-open','is-closing');openModal(d)}
function returnToLibrary(d){
 if(!d.open)return;
 clearTimeout(modalTimers.get(d));cancelAnimationFrame(modalFrames.get(d));d.close();d.classList.remove('is-open','is-closing');
 const library=$('#library');openModal(library);library.scrollTop=libraryReturnScroll;
 $(d.id==='netease'?'#netease-open':'#apple-open').focus({preventScroll:true});
}
for(const d of document.querySelectorAll('#netease, #apple-music'))d.querySelector('.provider-back').onclick=()=>returnToLibrary(d);
for(const [trigger,id] of [['library-open','library'],['appearance-open','appearance'],['cover-open','cover-dialog'],['help-open','help']])$('#'+trigger).onclick=()=>openModal($('#'+id));
document.querySelectorAll('dialog').forEach(d=>{d.querySelector('.close').onclick=()=>closeModal(d);d.addEventListener('cancel',e=>{e.preventDefault();if(d.id==='library'&&libraryPage==='editor')$('#library-back').click();else if(d.id==='netease'||d.id==='apple-music')returnToLibrary(d);else closeModal(d)});d.addEventListener('click',e=>{if(e.target===d){const b=d.getBoundingClientRect();if(e.clientX<b.left||e.clientX>b.right||e.clientY<b.top||e.clientY>b.bottom){if(d.id==='library'&&libraryPage==='editor')$('#library-back').click();else closeModal(d)}}})});
function setTheme(dark){const root=document.documentElement;root.style.setProperty('--ink',dark?'#e2e0d9':'#45443f');root.style.setProperty('--muted',dark?'#a39f96':'#83827d');root.style.setProperty('--line',dark?'#44443e':'#deddd8');root.style.setProperty('--panel',dark?'#20211f':'#faf9f6')}
function colorDark(hex){return parseInt(hex.slice(1,3),16)*.299+parseInt(hex.slice(3,5),16)*.587+parseInt(hex.slice(5,7),16)*.114<128}
function background(color){backgroundVersion++;document.body.style.backgroundImage='none';document.body.style.backgroundColor=color;setTheme(colorDark(color));document.querySelectorAll('[data-bg]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.bg===color)));if(bgURL){URL.revokeObjectURL(bgURL);bgURL=null}}
document.querySelectorAll('[data-bg]').forEach(b=>b.onclick=()=>background(b.dataset.bg));$('#bg-color').oninput=e=>background(e.target.value);
async function loadImage(file){if(!file)return null;const url=URL.createObjectURL(file),img=new Image();img.src=url;try{await img.decode();return {img,url}}catch{URL.revokeObjectURL(url);notice('这张图片无法读取，请选择 JPG、PNG 或 WebP。');return null}}
function averageColor(img){const canvas=document.createElement('canvas');canvas.width=canvas.height=16;const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(img,0,0,16,16);const d=ctx.getImageData(0,0,16,16).data;let r=0,g=0,b=0;for(let i=0;i<d.length;i+=4){r+=d[i];g+=d[i+1];b+=d[i+2]}return '#'+[r,g,b].map(v=>Math.round(v/256).toString(16).padStart(2,'0')).join('')}
$('#bg-import').onchange=async e=>{const version=++backgroundVersion,result=await loadImage(e.target.files[0]);e.target.value='';if(!result)return;if(version!==backgroundVersion){URL.revokeObjectURL(result.url);return}if(bgURL)URL.revokeObjectURL(bgURL);bgURL=result.url;document.body.style.backgroundImage=`url("${bgURL}")`;setTheme(colorDark(averageColor(result.img)));document.querySelectorAll('[data-bg]').forEach(b=>b.setAttribute('aria-pressed','false'))};
$('#cover-import').onchange=async e=>{const target=tracks[current],version=target.coverVersion=(target.coverVersion||0)+1;const result=await loadImage(e.target.files[0]);e.target.value='';if(!result)return;if(target.coverVersion!==version){URL.revokeObjectURL(result.url);return;}if(target.customCover){URL.revokeObjectURL(target.cover);urls.delete(target.cover)}target.cover=result.url;urls.add(result.url);target.customCover=true;cacheCoverInfo(target,result.img);target.description=target.provider==='netease'?'网易云音乐 · 自选封面':target.local?'本地音乐 · 自选封面':'原创示例音频 · 自选封面';if(target===tracks[current])artUI();else renderTracks()};
function readTrackTags(file,track){
 if(typeof jsmediatags==='undefined')return;
 const coverVersion=track.coverVersion||0;
 new jsmediatags.Reader(file).setTagsToRead(['title','artist','album','year','picture']).read({
  onSuccess:async result=>{
   const tags=result.tags||{};
   for(const key of ['title','artist','album','year']){if(typeof tags[key]==='string'&&tags[key].trim())track[key]=tags[key].trim()}
   const picture=tags.picture;
   if(picture&&picture.data&&/^image\/(jpeg|jpg|png|webp|gif)$/i.test(picture.format||'')&&(track.coverVersion||0)===coverVersion){
    const url=URL.createObjectURL(new Blob([new Uint8Array(picture.data)],{type:picture.format})),img=new Image();img.src=url;
    try{await img.decode();if((track.coverVersion||0)===coverVersion){if(urls.has(track.cover)){URL.revokeObjectURL(track.cover);urls.delete(track.cover)}track.cover=url;urls.add(url);cacheCoverInfo(track,img);track.description='本地音乐 · 文件内嵌封面'}else URL.revokeObjectURL(url)}catch{URL.revokeObjectURL(url)}
   }
   if(track===tracks[current])artUI();else renderTracks();
  },onError:()=>{}
 });
}
$('#audio-import').onchange=e=>{let added=0;const imported=[];for(const file of e.target.files){if(!file.type.startsWith('audio/')&&!/\.(mp3|m4a|wav|ogg|flac|aac)$/i.test(file.name)){notice('已略过非音频文件。');continue}const src=URL.createObjectURL(file);urls.add(src);const addedTrack={title:file.name.replace(/\.[^.]+$/,''),src,cover:'assets/cover-unavailable.svg',variant:'sunset',local:true,customCover:true,description:'本地音乐'};tracks.push(addedTrack);imported.push(addedTrack);matchTrackPlastic(addedTrack);readTrackTags(file,addedTrack);added++}e.target.value='';if(imported.length)importRackSongs(imported,{onDone:count=>notice('已加入 '+count+' 首本地音乐，可从磁带架选取。')});renderTracks()};
document.addEventListener('keydown',e=>{if(e.defaultPrevented||e.metaKey||e.ctrlKey||e.altKey||document.querySelector('dialog[open]')||e.target.matches('input,textarea,select,[contenteditable]')||e.target.closest('.preference-key')||(e.target.matches('button')&&!e.target.classList.contains('hardware')))return;if(e.code==='Space'){e.preventDefault();togglePlay()}else if(['ArrowLeft','ArrowRight'].includes(e.code)&&Number.isFinite(audio.duration)){e.preventDefault();audio.currentTime=Math.max(0,Math.min(audio.duration,audio.currentTime+(e.code==='ArrowLeft'?-5:5)));timeUI()}});
window.addEventListener('pagehide',e=>{if(!e.persisted){urls.forEach(u=>URL.revokeObjectURL(u));if(bgURL)URL.revokeObjectURL(bgURL)}});
window.addEventListener('resize',renderCoverTreatment);
let densityQuery;function watchPixelDensity(){if(densityQuery)densityQuery.removeEventListener('change',densityChanged);densityQuery=matchMedia(`(resolution: ${window.devicePixelRatio||1}dppx)`);densityQuery.addEventListener('change',densityChanged)}function densityChanged(){renderCoverTreatment();watchPixelDensity()}watchPixelDensity();
// Remember cloud catalogue data, never account credentials or expiring audio URLs.
const rackMemoryKey='buy-me-a-walkman.rack.v1';
let rackMemoryWarned=false;
function rackMemoryWarning(message){if(!rackMemoryWarned){rackMemoryWarned=true;notice(message)}}
function rememberedCloudTrack(value){
 if(!value||value.station||!['netease','apple'].includes(value.provider))return null;
 if(value.provider==='netease'?!/^[1-9]\d{0,17}$/.test(String(value.id)):!/^[a-zA-Z0-9.-]{1,80}$/.test(String(value.id)))return null;
 const text=(key,max=500)=>typeof value[key]==='string'?value[key].slice(0,max):'';
 let cover='assets/cover-unavailable.svg';
 try{
  const proxy=new URL(value.cover,location.origin);
  if(value.provider==='apple'&&proxy.origin===location.origin&&proxy.pathname==='/api/apple-music/image')cover=appleArtwork(proxy.searchParams.get('url'));
  if(value.provider==='netease'&&proxy.origin===location.origin&&proxy.pathname==='/api/netease/image'){
   const image=new URL(proxy.searchParams.get('url'));
   if(image.protocol==='https:'&&!image.username&&!image.password&&!image.port&&['music.126.net','music.163.com'].some(d=>image.hostname===d||image.hostname.endsWith('.'+d)))cover=neteaseArtwork('/api/netease/image?url='+encodeURIComponent(image.href));
  }
 }catch{}
 return {provider:value.provider,library:value.provider==='apple'&&value.library===true,sourceURL:value.provider==='apple'&&/^https:\/\/music\.apple\.com\//.test(text('sourceURL'))?text('sourceURL'):'',id:String(value.id),title:text('title')||'未命名曲目',artist:text('artist'),album:text('album'),year:text('year',20),duration:Number.isFinite(value.duration)&&value.duration>=0?value.duration:0,cover,variant:'sunset',description:value.provider==='apple'?'Apple Music':'网易云音乐',src:''};
}
function readRackMemory(){
 try{
  const raw=localStorage.getItem(rackMemoryKey);if(!raw)return {songs:[]};
  const saved=JSON.parse(raw);if(saved?.version!==1||!Array.isArray(saved.songs))return {songs:[]};
  const seen=new Set(),songs=[];
  for(const value of saved.songs){const song=rememberedCloudTrack(value);if(song&&!seen.has(song.provider+':'+song.id)){seen.add(song.provider+':'+song.id);songs.push(song)}}
  return {songs,selected:typeof saved.selected==='string'?saved.selected:''};
 }catch{rackMemoryWarning('磁带架记忆暂时无法读取，仍可正常添加和播放歌曲。');return {songs:[]}}
}
function saveRackMemory(){
 if(!rackStore)return false;
 rackStore.change(s=>{const t=tracks[current];s.selected=rackTrackKey(t);const saved=rememberedCloudTrack(t);if(saved)s.songs[rackTrackKey(t)]=saved});return !rackStore.failed;
}
const rememberedRack=readRackMemory();
initRacks(rememberedRack);
const rememberedIndex=tracks.findIndex(t=>rackTrackKey(t)===rackStore.state.selected);
selectTrack(rememberedIndex<0?0:rememberedIndex,false);
document.addEventListener('cassette-trackchange',saveRackMemory);
const initialArtworkReady=matchTrackPlastic(tracks[current]);
// Recover the remaining covers in small batches without holding up entry.
