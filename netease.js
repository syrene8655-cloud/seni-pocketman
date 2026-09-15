'use strict';
async function neteaseRequest(route,body={}, {timeoutMs=25000}={}){
 let response;try{response=await fetch('/api/netease/'+route,{method:'POST',headers:{'Content-Type':'application/json','X-Cassette-Client':'1'},body:JSON.stringify(body),signal:AbortSignal.timeout(timeoutMs)})}catch{throw Object.assign(new Error('连接超时，请检查网络后重试。'),{name:'NetworkError'})}
 let data;try{data=await response.json()}catch{throw new Error('音乐服务暂时没有响应，请稍后重试。')}
 if(!response.ok)throw Object.assign(new Error(data.error||'网易云暂时不可用，请稍后重试。'),{status:response.status});if(Array.isArray(data.items))for(const item of data.items)if(item.cover)item.cover=neteaseArtwork(item.cover);return data;
}
const cloud=$('#netease');let cloudProfile=null,cloudTimer,cloudLoginVersion=0,cloudResultsVersion=0,cloudView=null,cloudItems=[],cloudLoginDestination='playlists';
setMusicShortcutSelection(cloud);
function cloudMessage(message,error=false){$('#cloud-feedback').textContent=message;$('#cloud-feedback').dataset.error=String(error)}
function cloudAccount(profile){cloudProfile=profile;$('#cloud-account-name').textContent=profile?'已登录 · '+profile.nickname:'未登录 · 可以先搜索音乐';$('#cloud-login').hidden=!!profile;$('#cloud-logout').hidden=!profile;$('#cloud-my-playlists').hidden=!profile;document.dispatchEvent(new CustomEvent('cassette-accountchange',{detail:{profile}}))}
function stopCloudPolling(){cloudLoginVersion++;clearTimeout(cloudTimer)}
cloud.addEventListener('close',()=>{stopCloudPolling();cloudResultsVersion++;$('#cloud-more').disabled=false;$('#cloud-add-page').disabled=false});
$('#netease-open').onclick=async()=>{
 openMusicProvider(cloud);$('#cloud-qr').hidden=true;stopCloudPolling();const version=cloudLoginVersion;
 try{const r=await neteaseRequest('status');if(cloud.open&&version===cloudLoginVersion)cloudAccount(r.profile)}catch(e){if(cloud.open&&version===cloudLoginVersion)cloudMessage(e.message,true)}
};
async function cloudLogin(){
 const destination=cloudLoginDestination;
 stopCloudPolling();const version=cloudLoginVersion;$('#cloud-qr').hidden=false;$('#cloud-qr-image').hidden=true;$('#cloud-qr-status').textContent='正在生成二维码…';$('#cloud-qr-refresh').disabled=true;
 try{
  const r=await neteaseRequest('qr');if(version!==cloudLoginVersion||!cloud.open)return;
  $('#cloud-qr-image').src=r.image;$('#cloud-qr-image').hidden=false;$('#cloud-qr-status').textContent='使用网易云音乐 App 扫码，并在手机上确认';$('#cloud-qr-refresh').disabled=false;
  const poll=async()=>{
   if(version!==cloudLoginVersion||!cloud.open)return;
   try{const state=await neteaseRequest('qr-check');if(version!==cloudLoginVersion||!cloud.open)return;
    if(state.code===803){stopCloudPolling();invalidateCloudPlayback();cloudAccount(state.profile);$('#cloud-qr').hidden=true;cloudMessage('登录成功，可以打开你的歌单。');return loadCloud({type:destination,offset:0})}
    if(state.code===800){$('#cloud-qr-image').hidden=true;$('#cloud-qr-status').textContent='二维码已过期，请刷新。';return}
    $('#cloud-qr-status').textContent=state.code===802?'已扫码，请在手机上确认登录':'使用网易云音乐 App 扫码，并在手机上确认';cloudTimer=setTimeout(poll,2500);
   }catch(e){if(version===cloudLoginVersion)$('#cloud-qr-status').textContent=e.message+' 可刷新二维码重试。'}
  };cloudTimer=setTimeout(poll,2500);
 }catch(e){if(version===cloudLoginVersion){$('#cloud-qr-status').textContent=e.message;$('#cloud-qr-refresh').disabled=false}}
}
$('#cloud-login').onclick=()=>{cloudLoginDestination='playlists';return cloudLogin()};$('#cloud-qr-refresh').onclick=cloudLogin;
function invalidateCloudPlayback(){
 requestId++;if(swapping){cancelSwap();setDoor(false)}
 for(const t of tracks)if(t.provider==='netease'){t.src='';t.streamExpires=0;t.trial=false}
 if(tracks[current].provider==='netease'){audio.pause();audio.removeAttribute('src');audio.load();loading=false;timeUI();artUI();playbackUI()}
}
$('#cloud-logout').onclick=async()=>{
 stopCloudPolling();cloudResultsVersion++;invalidateCloudPlayback();const version=cloudLoginVersion;
 try{await neteaseRequest('logout');if(version!==cloudLoginVersion)return;cloudAccount(null);cloudItems=[];cloudView=null;setMusicShortcutSelection(cloud);$('#cloud-results').replaceChildren();$('#cloud-more').hidden=true;$('#cloud-add-page').hidden=true;$('#cloud-results-title').textContent='找到音乐后，加入你的磁带架';cloudMessage('已退出网易云登录。')}
 catch(e){if(version===cloudLoginVersion)cloudMessage(e.message,true)}
};
function addCloudSongs(songs,choose=false){importRackSongs(songs,{choose,name:cloudView?.name||(cloudView?.type==='daily'?'每日推荐':'网易云歌单'),source:cloudView&&['daily','playlist'].includes(cloudView.type)?{provider:'netease',id:cloudView.id||'daily'}:null,onDone:count=>{cloudMessage('已加入 '+count+' 首歌曲。');renderCloudResults()}})}
function renderCloudResults(){
 const list=$('#cloud-results');list.replaceChildren();
 for(const item of cloudItems){const row=document.createElement('div');row.className='cloud-row';const img=new Image();img.src=item.cover;img.alt='';img.loading='lazy';img.onerror=()=>{img.onerror=null;img.src='assets/cover-unavailable.svg'};
 const info=document.createElement('div');info.className='cloud-row-info';const title=document.createElement('strong'),detail=document.createElement('small');title.textContent=cloudView.type==='playlists'?item.name:item.title;detail.textContent=cloudView.type==='playlists'?item.count+' 首':item.artist+(item.album?' · '+item.album:'');if(cloudView.type!=='playlists')detail.setAttribute('translate','no');info.append(title,detail);
 const button=document.createElement('button');button.type='button';if(cloudView.type==='playlists'){button.textContent='打开';button.setAttribute('aria-label','打开歌单 '+item.name);button.onclick=()=>loadCloud({type:'playlist',id:item.id,offset:0,source:'playlists'})}else{const exists=targetHasSong(item);button.textContent=exists?'已加入':'加入';button.disabled=exists;button.setAttribute('aria-label','加入 '+item.title+' 到磁带架');button.onclick=()=>{addCloudSongs([item]);renderCloudResults()}}
 row.append(img,info,button);list.append(row);
 }
 $('#cloud-add-page').hidden=!cloudItems.length||cloudView.type==='playlists';$('#cloud-add-page').textContent=cloudView.type==='daily'?'全部加入磁带架':'加入本页歌曲';
}
async function loadCloud(view,append=false){
 const version=++cloudResultsVersion;$('#cloud-more').disabled=true;$('#cloud-add-page').disabled=true;cloudMessage('正在读取…');
 if(!append){cloudView=view;cloudItems=[];setMusicShortcutSelection(cloud,view.type==='daily'?'cloud-daily':view.type==='playlists'||view.source==='playlists'?'cloud-my-playlists':'');renderCloudResults();$('#cloud-more').hidden=true;$('#cloud-results-title').textContent=view.type==='daily'?'每日推荐':view.type==='playlists'?'我的歌单':view.type==='playlist'?'歌单歌曲':'搜索结果'}
 try{
  const r=await neteaseRequest(view.type,view);if(version!==cloudResultsVersion||!cloud.open)return;
  cloudView={...view,name:r.name||(view.type==='daily'?'每日推荐':'网易云歌单')};cloudItems=append?[...cloudItems,...r.items]:r.items;
  if(view.type==='playlist')PocketmanI18n.setNamedTitle($('#cloud-results-title'),r.name,r.total);else $('#cloud-results-title').textContent=view.type==='daily'?'每日推荐 · '+r.date+' · '+r.total+' 首':view.type==='playlists'?'我的歌单':'搜索结果';
  renderCloudResults();$('#cloud-more').hidden=!r.more;cloudMessage(!cloudItems.length&&view.type==='daily'?'今天暂时没有推荐歌曲，可以稍后再来看看。':cloudItems.length?'已显示 '+cloudItems.length+(view.type==='playlists'?' 个歌单':' 首歌曲'):'没有找到结果，请换个关键词或歌单。');
 }catch(e){if(version===cloudResultsVersion){if(e.status===401)cloudAccount(null);cloudMessage(e.message,true)}}finally{if(version===cloudResultsVersion){$('#cloud-more').disabled=false;$('#cloud-add-page').disabled=false}}
}
$('#cloud-daily').onclick=()=>{if(!cloudProfile){cloudLoginDestination='daily';cloudMessage('扫码登录后，就能读取网易云为你推荐的歌曲。');return cloudLogin()}return loadCloud({type:'daily',offset:0})};
$('#cloud-my-playlists').onclick=()=>loadCloud({type:'playlists',offset:0});
$('#cloud-search').onsubmit=e=>{e.preventDefault();loadCloud({type:'search',keywords:$('#cloud-keywords').value.trim(),offset:0})};
let cloudShareVersion=0;
$('#cloud-playlist').onsubmit=async e=>{
 e.preventDefault();const value=$('#cloud-playlist-id').value.trim(),version=++cloudResultsVersion,shareVersion=++cloudShareVersion,button=$('#cloud-playlist button');
 if(!value){cloudMessage('请粘贴网易云歌单分享内容或歌单编号。',true);return}
 button.disabled=true;$('#cloud-more').disabled=true;$('#cloud-add-page').disabled=true;cloudMessage('正在识别歌单分享链接…');
 try{const result=await neteaseRequest('resolve-playlist',{value});if(version!==cloudResultsVersion||!cloud.open)return;await loadCloud({type:'playlist',id:result.id,offset:0})}
 catch(error){if(version===cloudResultsVersion&&cloud.open)cloudMessage(error.message,true)}
 finally{if(shareVersion===cloudShareVersion)button.disabled=false;if(version===cloudResultsVersion){$('#cloud-more').disabled=false;$('#cloud-add-page').disabled=false}}
};
$('#cloud-more').onclick=()=>{if(cloudView)loadCloud({...cloudView,offset:cloudView.offset+(cloudView.type==='playlist'?50:30)},true)};
$('#cloud-add-page').onclick=()=>{addCloudSongs(cloudItems,true);renderCloudResults()};
