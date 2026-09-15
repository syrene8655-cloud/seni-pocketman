'use strict';
// Persist membership separately from the playback catalogue. Mutations re-read the
// latest snapshot; never union deleted memberships back in from an older tab.
class RackStore{
 constructor(storage,legacy,serialize,warn){this.storage=storage;this.serialize=serialize;this.warn=warn;this.key='buy-me-a-walkman.racks.v2';this.failed=false;
  const saved=this.read();this.state=saved||{version:2,revision:0,defaultNameVersion:1,racks:[{id:'main',name:'My Mix',kind:'manual',items:['demo',...legacy.songs.map(t=>rackTrackKey(t))],scroll:0}],songs:Object.fromEntries(legacy.songs.map(t=>[rackTrackKey(t),serialize(t)])),active:'main',selected:legacy.selected||'demo'};
  if(saved&&!saved.defaultNameVersion&&!this.failed)this.change(s=>{const main=s.racks.find(r=>r.id==='main');if(main?.name==='我的磁带')main.name='My Mix';s.defaultNameVersion=1});
  if(!saved&&!this.failed){try{const raw=storage.getItem('buy-me-a-walkman.rack.v1');if(raw&&!storage.getItem('buy-me-a-walkman.rack.v1.backup'))storage.setItem('buy-me-a-walkman.rack.v1.backup',raw);storage.setItem(this.key,JSON.stringify(this.state))}catch{this.failed=true;warn('浏览器未能保存磁带架，刷新后修改可能丢失。')}}
 }
 read(){try{const raw=this.storage.getItem(this.key);if(!raw)return null;const s=JSON.parse(raw);if(s.version!==2||!Array.isArray(s.racks)||!s.racks.length||s.racks.length>6||!s.songs||s.racks.some(r=>!r.id||typeof r.name!=='string'||!Array.isArray(r.items)||!['manual','radio'].includes(r.kind)))throw Error();return s}catch{this.failed=true;this.warn('磁带架存档无法读取，原存档已保留，请先导出备份或检查浏览器存储。');return null}}
 change(fn){const next=JSON.parse(JSON.stringify(this.failed?this.state:(this.read()||this.state)));const value=fn(next);next.revision++;this.state=next;if(!this.failed)try{this.storage.setItem(this.key,JSON.stringify(next))}catch{this.failed=true;this.warn('浏览器未能保存磁带架，刷新后修改可能丢失。')}return value}
 rack(id=this.state.active){return this.state.racks.find(r=>r.id===id)||this.state.racks[0]}
 create(name,kind='manual',source=null){return this.change(s=>{if(s.racks.length>=6)throw Error('RACK_LIMIT');const id=crypto.randomUUID();s.racks.push({id,name:name.trim().slice(0,100)||'新磁带架',kind,source,items:[],scroll:0});return id})}
 add(id,songs,{replace=false}={}){return this.change(s=>{const r=s.racks.find(r=>r.id===id);if(!r)throw Error('这个磁带架已被移除，请重新选择。');const keys=songs.map(t=>{const key=rackTrackKey(t),saved=this.serialize(t);if(saved)s.songs[key]=saved;return key});const before=new Set(r.items);r.items=replace?[...new Set(keys)]:[...new Set([...r.items,...keys])];return keys.filter(k=>!before.has(k)).length})}
 remove(id){return this.change(s=>{if(s.racks.length===1)throw Error('请至少保留一个磁带架。');s.racks=s.racks.filter(r=>r.id!==id);if(s.active===id)s.active=s.racks[0].id})}
}
function rackTrackKey(t){return t.station?'station:'+t.id:t.local?(t.localKey||= 'local:'+crypto.randomUUID()):t.provider?t.provider+':'+(t.library?'library:':'')+t.id:'demo'}
let rackStore=null,playbackRackId='main',playbackKeys=[],rackViewRows=[],rackUIReady=false,pendingRackImport=null,radioBusy=false;
const radioQueues=new Map(),radioSuppressed=new Map();
const catalogueLookup=new Map();let catalogueLength=0;
function trackIndexForKey(key){for(;catalogueLength<tracks.length;catalogueLength++)catalogueLookup.set(rackTrackKey(tracks[catalogueLength]),catalogueLength);return catalogueLookup.get(key)??-1}
function catalogueIndex(t){const key=rackTrackKey(t),i=trackIndexForKey(key);if(i>=0)return i;tracks.push(t);catalogueLookup.set(key,tracks.length-1);catalogueLength=tracks.length;return tracks.length-1}
function hydrateRackCatalogue(){for(const value of Object.values(rackStore.state.songs)){const t=rememberedCloudTrack(value);if(t)catalogueIndex(t)}}
function initRacks(legacy){let storage;try{storage=localStorage}catch{storage={getItem(){throw Error()},setItem(){throw Error()}}}rackStore=new RackStore(storage,legacy,rememberedCloudTrack,rackMemoryWarning);hydrateRackCatalogue();const playing=rackStore.state.racks.find(r=>r.items.includes(rackStore.state.selected))||rackStore.rack();playbackKeys=[...playing.items];playbackRackId=playing.id;
 window.addEventListener('storage',e=>{if(e.key!==rackStore.key)return;const saved=rackStore.read();if(saved){rackStore.state=saved;hydrateRackCatalogue();pullCase(-1);renderTracks();if(rackUIReady)renderRackManager()}});
}
function visibleRackRows(r=rackStore?.rack()){if(!rackStore)return tracks.map((t,index)=>({t,index,key:rackTrackKey(t)}));
 const rows=r.items.map(key=>{const index=trackIndexForKey(key);return index<0?null:{key,t:tracks[index],index,state:'saved'}}).filter(Boolean);
 if(r.kind==='radio'){
  const station=tracks.find(t=>t.station&&t.id===r.source?.id),live=station?.radioSong;
  if(live&&audio.track===station){const key=rackTrackKey(live);const old=rows.find(x=>x.key===key);if(old){old.state='current';old.index=tracks.indexOf(station);old.t=station}else rows.push({key,t:station,index:tracks.indexOf(station),state:'current'})}
  for(const t of radioQueues.get(r.source?.id)||[]){const key=rackTrackKey(t);if(!rows.some(x=>x.key===key))rows.push({key,t,index:catalogueIndex(t),state:'upcoming'})}
 }
 return rows;
}
function fitRackName(){const el=$('#rack-nameplate-title');el.classList.remove('long-name');el.style.fontSize='42px';const ctx=document.createElement('canvas').getContext('2d');if(!ctx?.measureText)return;const style=getComputedStyle(el);ctx.font=`${style.fontWeight} 42px ${style.fontFamily}`;const width=ctx.measureText(el.textContent).width;el.style.fontSize=Math.max(28,Math.min(42,42*250/Math.max(width,1)))+'px'}
// Reveal the playing tape without replacing its playback queue or starting audio.
function revealPlayingTape(){
 if(!rackStore)return;const track=tracks[current];if(!track)return;
 const key=rackTrackKey(track),contains=r=>track.station?r.kind==='radio'&&r.source?.id===track.id:r.items.includes(key);
 const target=rackStore.state.racks.find(r=>r.id===playbackRackId&&contains(r))||rackStore.state.racks.find(contains);if(!target)return;
 const rows=visibleRackRows(target),position=rows.findIndex(row=>track.station?row.state==='current':row.key===key);
 const scroll=position>=0?Math.floor(position/6)*6:target.scroll||0;
 pullCase(-1);rackStore.change(s=>{s.active=target.id;s.racks.find(r=>r.id===target.id).scroll=scroll});renderTracks();
}
function choosePlaybackRack(){if(!rackStore)return;playbackRackId=rackStore.rack().id;playbackKeys=visibleRackRows().filter(x=>x.state!=='upcoming').map(x=>rackTrackKey(x.t.station?x.t.radioSong:x.t));}
const rackTransitions=new Map();
function animateRackChange(el,axis,direction){
 rackTransitions.get(el)?.cancel?.();rackTransitions.delete(el);
 if(reduceMotion.matches)return;
 const animation=el.animate([{opacity:.4,transform:`translate${axis}(${direction*9}px)`},{opacity:1,transform:'none'}],{duration:200,easing:'ease-out'});
 rackTransitions.set(el,animation);
 animation.finished?.then(()=>{if(rackTransitions.get(el)===animation)rackTransitions.delete(el)}).catch(()=>{});
}
function switchRack(id,{animate=true}={}){if(!rackStore||swapping||id===rackStore.state.active)return;const old=rackStore.state.active,scroll=rackStore.rack().scroll||0;pullCase(-1);
 rackStore.change(s=>{const prev=s.racks.find(r=>r.id===old);if(prev)prev.scroll=scroll;if(s.racks.some(r=>r.id===id))s.active=id});renderTracks();$('#rack-slots').scrollTop=0;
 if(animate){const order=rackStore.state.racks;animateRackChange($('.rack'),'X',order.findIndex(r=>r.id===id)>order.findIndex(r=>r.id===old)?1:-1)}
}
function stepRack(direction){const list=rackStore.state.racks,i=list.findIndex(r=>r.id===rackStore.state.active),next=list[i+direction];if(next)switchRack(next.id)}
function refreshRackControls(){if(!rackUIReady)return;updateLibraryDestination();const list=rackStore.state.racks,i=list.findIndex(r=>r.id===rackStore.state.active);$('#rack-previous').hidden=$('#rack-next').hidden=list.length<2;$('#rack-previous').disabled=i<=0;$('#rack-next').disabled=i>=list.length-1;$('#rack-manager-count').textContent=list.length+' / 6';$('#rack-number').textContent=list.length>1?`${i+1} / ${list.length}`:'';$('#rack-resume').hidden=rackStore.rack().kind!=='radio';$('#rack-empty').hidden=!!rackViewRows.length;$('#rack-hint').hidden=!rackViewRows.length;$('#rack-empty').textContent=rackStore.rack().kind==='radio'?'收听电台 →':'添加音乐 →';}
function showRackLimit(){notice('已经有 6 个磁带架了，请先移除一个再新建。');$('#rack-limit').hidden=false;openRackManager()}
function safeCreateRack(name,kind='manual',source=null){try{return rackStore.create(name,kind,source)}catch(e){if(e.message==='RACK_LIMIT'){showRackLimit();return null}throw e}}
function addSongsToRack(songs,id=rackStore.state.active,options={}){const r=rackStore.state.racks.find(r=>r.id===id);if(!r||r.kind==='radio')throw Error('请选择普通磁带架来添加歌曲。');for(const t of songs)catalogueIndex(t);const count=rackStore.add(id,songs,options);if(id!==rackStore.state.active)switchRack(id);else renderTracks();return count}
function targetHasSong(t){return rackStore.rack().kind==='manual'&&rackStore.rack().items.includes(rackTrackKey(t))}
function importRackSongs(songs,{name='新磁带架',source=null,choose=false,onDone=()=>{}}={}){if(!songs.length)return;
 if(!choose&&rackStore.rack().kind==='manual'){try{onDone(addSongsToRack(songs))}catch(e){notice(e.message)}return}
 pendingRackImport={songs,name,source,onDone};const d=$('#rack-import');$('#rack-import-name').value=name;$('#rack-import-replace').checked=false;renderImportTargets();const same=source&&rackStore.state.racks.find(r=>r.source?.provider===source.provider&&r.source?.id===source.id);if(same)$('#rack-import-target').value=same.id;else if(source?.id==='daily')$('#rack-import-target').value='new';renderImportTargets();openModal(d);
}
function renderImportTargets(){const select=$('#rack-import-target'),old=select.value;select.replaceChildren();for(const r of rackStore.state.racks.filter(r=>r.kind==='manual'))select.add(new Option('加入「'+r.name+'」',r.id));select.add(new Option('新建磁带架','new'));select.value=[...select.options].some(o=>o.value===old)?old:rackStore.rack().kind==='manual'?rackStore.state.active:'new';$('#rack-import-name').hidden=select.value!=='new';$('#rack-import-replace-wrap').hidden=!pendingRackImport?.source||select.value==='new';}
function waitForRadioStart(control){let cancel=()=>{};const promise=new Promise((resolve,reject)=>{const timer=setTimeout(()=>finish(new Error('电台未开始播放，请检查网络后重试。')),20000);const playing=()=>{if(audio.track===control)finish()},failed=()=>finish(new Error('电台暂时无法播放，请检查订阅或网络。'));cancel=()=>{clearTimeout(timer);audio.removeEventListener('playing',playing);audio.removeEventListener('error',failed)};function finish(error){cancel();error?reject(error):resolve()}audio.addEventListener('playing',playing);audio.addEventListener('error',failed)});return {promise,cancel:()=>cancel()}}
async function startRadioRack(item){if(radioBusy)return;radioBusy=true;let newId=null;const before=current;
 try{const music=await appleMusic.ready();if(!music.isAuthorized)throw Error('请先连接 Apple Music 账号。');const existing=rackStore.state.racks.find(r=>r.kind==='radio'&&r.source?.id===item.id);if(!existing&&rackStore.state.racks.length>=6){pendingRackImport={radio:item};showRackLimit();return}
  const control={...item,station:true,stationName:item.title,stationCover:item.cover,provider:'apple',artist:'Apple Music',album:'我的电台',duration:0,variant:'sunset',src:''};const index=catalogueIndex(control);
  requestId++;selectTrack(index,false);loading=true;playbackUI();const began=waitForRadioStart(tracks[index]);try{await Promise.all([audio.play(),began.promise])}finally{began.cancel()}if(current!==index||!audio.isStation)return;
  const id=existing?.id||(newId=rackStore.create(item.title,'radio',{id:item.id,title:item.title,cover:item.cover}));playbackRackId=id;playbackKeys=[rackTrackKey(tracks[index])];switchRack(id);rememberRadioHeard();updateRadioQueue();const position=visibleRackRows().findIndex(x=>x.state==='current');if(position>=0)rackStore.change(s=>{s.racks.find(r=>r.id===id).scroll=Math.floor(position/6)*6});renderTracks();
 }catch(e){if(newId)rackStore.remove(newId);if(tracks[current]?.station)selectTrack(before,false);if(e.message==='RACK_LIMIT'){pendingRackImport={radio:item};showRackLimit();return}notice(e.message||'电台暂时无法播放，请重试。')}finally{radioBusy=false}}
function rememberRadioHeard(){if(!rackStore||!audio.isStation||audio.paused||!audio.track.radioHeard||!audio.track.radioSong)return;const r=rackStore.state.racks.find(r=>r.kind==='radio'&&r.source?.id===audio.track.id);if(!r)return;const song=audio.track.radioSong,key=rackTrackKey(song);if(radioSuppressed.get(r.id)?.has(key))return;catalogueIndex(song);if(!r.items.includes(key))rackStore.add(r.id,[song]);renderRack();}
function updateRadioQueue(){if(!audio.isStation)return;radioQueues.set(audio.track.id,audio.track.radioUpcoming||[]);if(rackStore.rack().source?.id===audio.track.id)renderRack()}
function rackAction(label,action){const b=document.createElement('button');b.type='button';b.textContent=label;b.className='text-button';b.onclick=action;return b}
let managedRackId=null,managePage=0,libraryPage='racks',libraryPageAnimation=null;
function showLibraryPage(page,{focus=false}={}){
 const changed=libraryPage!==page;libraryPage=page;
 $('#rack-manager').hidden=page!=='racks';$('#rack-editor').hidden=page!=='editor';$('#library-music').hidden=page!=='music';
 $('#library-tabs').hidden=page==='editor';$('#library-back').hidden=page!=='editor';$('#library-title').textContent=page==='editor'?'整理磁带架':'曲目';
 $('#racks-open').setAttribute('aria-pressed',String(page==='racks'));$('#rack-manager-back').setAttribute('aria-pressed',String(page==='music'));
 if(changed){$('#library').scrollTop=0;libraryPageAnimation?.cancel?.();if(!reduceMotion.matches)libraryPageAnimation=$('#library-content').animate([{opacity:.55,transform:'translateY(4px)'},{opacity:1,transform:'none'}],{duration:160,easing:'ease-out'})}
 if(page==='music')updateLibraryDestination();
 if(focus)$(page==='editor'?'#library-back':page==='music'?'#rack-manager-back':'#racks-open').focus({preventScroll:true});
}
function updateLibraryDestination(){const r=rackStore.rack();$('#library-destination').textContent=r.kind==='radio'?'选择歌曲后，可以放进普通磁带架。':`单曲将加入「${r.name}」，导入歌单时可另选磁带架。`}
function openRackManager(){document.querySelectorAll('dialog[open]').forEach(d=>{if(d.id!=='library')d.close()});showLibraryPage('racks');renderRackManager();openModal($('#library'))}
function openRackEditor(id){managedRackId=id;managePage=0;$('#rack-editor-feedback').textContent='';showLibraryPage('editor',{focus:true});renderRackEditor()}
function moveManagedRack(id,direction){rackStore.change(s=>{const n=s.racks.findIndex(x=>x.id===id),next=n+direction;if(n>=0&&next>=0&&next<s.racks.length)[s.racks[n],s.racks[next]]=[s.racks[next],s.racks[n]]});renderRackManager();refreshRackControls();[...$('#rack-manager-list').children].find(row=>row.dataset.rackId===id)?.querySelector('.rack-manage-select')?.focus({preventScroll:true})}
function renderRackManager(){if(!rackUIReady)return;const area=$('#rack-manager-list');area.replaceChildren();$('#rack-manager-count').textContent=rackStore.state.racks.length+' / 6';if(rackStore.state.racks.length<6)$('#rack-limit').hidden=true;
 for(const [i,r] of rackStore.state.racks.entries()){
 const row=document.createElement('div');row.className='rack-manage-row';row.dataset.rackId=r.id;
 const select=rackAction('',()=>openRackEditor(r.id));select.className='rack-manage-select';select.setAttribute('aria-label','整理 '+r.name);
 const name=document.createElement('strong');name.textContent=r.name;const meta=document.createElement('small');meta.textContent=(r.kind==='radio'?'Apple Music 电台':'普通磁带架')+' · '+r.items.length+' 首';select.append(name,meta);
 const order=document.createElement('div');order.className='rack-order';for(const [direction,label]of[[-1,'↑'],[1,'↓']]){const button=rackAction(label,()=>moveManagedRack(r.id,direction));button.setAttribute('aria-label',(direction<0?'向前移动 ':'向后移动 ')+r.name);button.disabled=direction<0?i===0:i===rackStore.state.racks.length-1;order.append(button)}
 row.append(select,order);area.append(row)}
 $('#rack-import-continue').hidden=!pendingRackImport;
}
function moveManagedTrack(key,direction){const r=rackStore.state.racks.find(x=>x.id===managedRackId);if(!r||r.kind!=='manual')return;const next=r.items.indexOf(key)+direction;if(next<0||next>=r.items.length)return;rackStore.change(s=>{const a=s.racks.find(x=>x.id===managedRackId).items,n=a.indexOf(key);[a[n],a[next]]=[a[next],a[n]]});managePage=Math.floor(next/30);renderRackEditor();renderRack();$('#rack-editor-tracks').children[next%30]?.querySelector('button')?.focus({preventScroll:true})}
function renderRackEditor(){const r=rackStore.state.racks.find(x=>x.id===managedRackId);if(!r)return;managePage=Math.min(managePage,Math.max(0,Math.ceil(r.items.length/30)-1));$('#rack-editor-name').value=r.name;
 $('#rack-editor-summary').textContent=r.items.length+' 首'+(r.kind==='radio'?' · 电台收听记录，按播放顺序保留':' · 可调整曲目顺序');$('#rack-editor-empty').hidden=!!r.items.length;$('#rack-editor-add').hidden=r.kind==='radio';$('#rack-editor-empty-text').textContent=r.kind==='radio'?'开始收听后，播放过的歌曲会留在这里。':'这里还没有磁带。';$('#rack-delete').disabled=rackStore.state.racks.length===1;$('.rack-editor-danger .subtle').textContent=rackStore.state.racks.length===1?'请至少保留一个磁带架。':'仅移除随身听里的列表，不影响音乐平台的歌单和收藏。';
 const list=$('#rack-editor-tracks');list.replaceChildren();const start=managePage*30,items=r.items.slice(start,start+30);
 for(const [offset,key]of items.entries()){const t=tracks.find(t=>rackTrackKey(t)===key),title=t?.title||'本地音频 · 需要重新导入';const row=document.createElement('div');row.className='rack-edit-track';const number=document.createElement('span');number.className='rack-track-number';number.textContent=String(start+offset+1).padStart(2,'0');const info=document.createElement('div');info.className='rack-track-info';const name=document.createElement('strong');name.textContent=title;const detail=document.createElement('small');detail.textContent=t?[t.artist,t.album].filter(Boolean).join(' · '):'请重新导入本地文件';info.append(name,detail);
 const actions=document.createElement('div');actions.className='rack-track-actions';if(r.kind==='manual'){for(const [direction,label]of[[-1,'↑'],[1,'↓']]){const button=rackAction(label,()=>moveManagedTrack(key,direction));button.disabled=direction<0?start+offset===0:start+offset===r.items.length-1;button.setAttribute('aria-label',(direction<0?'上移 ':'下移 ')+title);actions.append(button)}}
 const copy=rackAction('复制到…',()=>{if(t)importRackSongs([t],{choose:true,name:r.name+' · 收藏'})});copy.disabled=!t;copy.setAttribute('aria-label','复制 '+title+' 到其他磁带架');
 const remove=rackAction('移除',()=>{rackStore.change(s=>{const a=s.racks.find(x=>x.id===r.id);a.items=a.items.filter(k=>k!==key)});if(r.kind==='radio'){if(!radioSuppressed.has(r.id))radioSuppressed.set(r.id,new Set());radioSuppressed.get(r.id).add(key)}renderRackEditor();renderRack();renderRackManager();$('#rack-editor-feedback').textContent='已移除「'+title+'」';$('#rack-editor-tracks').children[Math.min(offset,list.children.length-1)]?.querySelector('button')?.focus({preventScroll:true})});remove.setAttribute('aria-label','从这个磁带架移除 '+title);actions.append(copy,remove);row.append(number,info,actions);list.append(row)}
 const last=Math.min(r.items.length,start+30);$('#rack-editor-page').textContent=r.items.length?`${start+1}–${last} / ${r.items.length} 首`:'';$('#rack-editor-prev').disabled=!managePage;$('#rack-editor-next').disabled=start+30>=r.items.length;$('.rack-editor-pager').hidden=r.items.length<=30;
}
function setupRackUI(){
 $('#rack-empty').onclick=()=>{if(rackStore.rack().kind==='radio')$('#rack-resume').click();else{showLibraryPage('music');openModal($('#library'))}};rackUIReady=true;$('#racks-open').onclick=()=>{showLibraryPage('racks');renderRackManager()};$('#rack-manager-back').onclick=()=>showLibraryPage('music');$('#library-back').onclick=()=>{showLibraryPage('racks',{focus:true});renderRackManager()};
 $('#rack-new').onclick=()=>{const id=safeCreateRack(PocketmanI18n.text('新磁带架'));if(id){renderRackManager();openRackEditor(id);$('#rack-editor-name').focus();$('#rack-editor-name').select();refreshRackControls()}};
 $('#rack-editor-save').onclick=()=>{const name=$('#rack-editor-name').value.trim();if(!name){$('#rack-editor-feedback').textContent='请填写磁带架名称。';$('#rack-editor-name').focus();return}rackStore.change(s=>{const r=s.racks.find(x=>x.id===managedRackId);if(r){r.name=name.slice(0,100);r.nameIsCustom=true}});renderRackManager();renderRack();$('#rack-editor-feedback').textContent='名称已保存';};
 $('#rack-editor-name').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();$('#rack-editor-save').click()}});
 $('#rack-editor-open').onclick=()=>{switchRack(managedRackId);closeModal($('#library'));setBrowsing(true,{revealCurrent:false})};
 $('#rack-editor-add').onclick=()=>{switchRack(managedRackId);showLibraryPage('music',{focus:true})};
 $('#rack-editor-prev').onclick=()=>{managePage--;renderRackEditor();$('#library').scrollTop=0};$('#rack-editor-next').onclick=()=>{managePage++;renderRackEditor();$('#library').scrollTop=0};
 $('#rack-delete').onclick=()=>{const r=rackStore.state.racks.find(x=>x.id===managedRackId);if(!r)return;if(!confirm(PocketmanI18n.text('移除「'+r.name+'」？仅移除随身听中的列表，不影响音乐平台的歌单和收藏。')))return;try{rackStore.remove(r.id);managedRackId=null;showLibraryPage('racks',{focus:true});pullCase(-1);renderTracks();renderRackManager()}catch(e){$('#rack-editor-feedback').textContent=e.message}};
 $('#rack-import .close').onclick=()=>{pendingRackImport=null;closeModal($('#rack-import'))};$('#rack-import').addEventListener('cancel',()=>pendingRackImport=null);$('#rack-import-target').onchange=renderImportTargets;
 $('#rack-import-submit').onclick=()=>{const p=pendingRackImport;if(!p?.songs)return;let id=$('#rack-import-target').value;if(id==='new'){id=safeCreateRack($('#rack-import-name').value,'manual',p.source);if(!id)return}const replace=!$('#rack-import-replace-wrap').hidden&&$('#rack-import-replace').checked;if(replace&&!confirm(PocketmanI18n.text('用这次读取的歌曲替换目标架？其他磁带架不受影响。')))return;try{const count=addSongsToRack(p.songs,id,{replace});pendingRackImport=null;$('#rack-import').close();p.onDone(count);notice('已加入 '+count+' 首歌曲');if($('#library').open)renderRackManager()}catch(e){notice(e.message)}};
 $('#rack-import-continue').onclick=()=>{const p=pendingRackImport;if(p?.radio){pendingRackImport=null;startRadioRack(p.radio)}else if(p){renderImportTargets();openModal($('#rack-import'))}};
 $('#rack-resume').onclick=()=>{const r=rackStore.rack();if(r.source)startRadioRack({...r.source,title:r.source.title||r.name})};
 $('#rack-previous').onclick=()=>stepRack(-1);$('#rack-next').onclick=()=>stepRack(1);
 $('#library-open').onclick=()=>{showLibraryPage('racks');renderRackManager();openModal($('#library'))};renderRackManager();
 // A gesture keeps its axis; trackpad momentum must not advance several racks.
 const region=$('#cassette-rack');let gesture=null;
 region.addEventListener('wheel',e=>{
  if(e.ctrlKey||!browsing||swapping||document.querySelector('dialog[open]')||e.target.closest('#tape-booklet')){gesture=null;return}
  const now=performance.now(),fresh=!gesture||now-gesture.last>160;
  if(fresh){const horizontal=Math.abs(e.deltaX)>Math.abs(e.deltaY)*1.2;gesture={axis:horizontal||e.target.closest('.rack-switch-zone')?'horizontal':'vertical',useX:horizontal,last:now,sum:0,direction:0,consumed:false,next:0}}
  const g=gesture;g.last=now;
  if(g.axis==='horizontal'?rackStore.state.racks.length<2:rackViewRows.length<=6)return;
  e.preventDefault();const raw=g.useX?e.deltaX:e.deltaY,delta=raw*(e.deltaMode===1?16:e.deltaMode===2?240:1);if(!delta)return;
  if(g.axis==='horizontal'){
   if(g.consumed)return;g.sum+=delta;if(Math.abs(g.sum)>=32){stepRack(Math.sign(g.sum));g.consumed=true}return;
  }
  const direction=Math.sign(delta);if(direction!==g.direction){g.sum=0;g.next=0}g.direction=direction;
  // Line-mode mouse notches are discrete. Pixel streams advance one visible row at a time.
  if(e.deltaMode===1){browseRack(direction);g.sum=0;return}
  if(now<g.next)return;g.sum+=Math.max(-40,Math.min(40,delta));
  if(Math.abs(g.sum)>=32){browseRack(direction);g.sum=0;g.next=now+90}
 },{passive:false});
 let press=null;region.addEventListener('pointerdown',e=>{if(e.button!==0||e.target.closest('button,.case,#tape-booklet')||swapping)return;press={id:e.pointerId,x:e.clientX,y:e.clientY};});region.addEventListener('pointerup',e=>{if(!press||e.pointerId!==press.id)return;const x=e.clientX-press.x,y=e.clientY-press.y;press=null;if(Math.abs(x)>45&&Math.abs(x)>Math.abs(y)*1.3)stepRack(x<0?1:-1)});region.addEventListener('pointercancel',()=>press=null);region.addEventListener('pointerleave',()=>press=null);
 region.addEventListener('keydown',e=>{if(!e.target.closest('.rack-switch-zone'))return;if(['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();stepRack(e.key==='ArrowLeft'?-1:1)}});
 audio.addEventListener('stationheard',rememberRadioHeard);audio.addEventListener('stationitemchange',()=>{updateRadioQueue()});audio.addEventListener('stationqueuechange',updateRadioQueue);
 document.addEventListener('cassette-trackchange',()=>{if(!audio.isStation&&radioQueues.size){radioQueues.clear();renderRack()}});
 refreshRackControls();fitRackName();
}
