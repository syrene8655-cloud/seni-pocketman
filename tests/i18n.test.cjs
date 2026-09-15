'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {JSDOM}=require('jsdom');
const source=fs.readFileSync(path.join(__dirname,'../i18n.js'),'utf8');
const {translate}=require('../i18n.js');
const tick=()=>new Promise(resolve=>setTimeout(resolve,0));
function fixture(language){const dom=new JSDOM('<!doctype html><html><body><button id="play" aria-label="播放">播放</button><p id="notice">正在读取…</p><span id="track-name">暂停</span><strong id="rack-nameplate-title">我的磁带架</strong><div class="cloud-row-info"><strong>停止</strong><small translate="no">我的电台</small></div><input id="rack-editor-name" value="外观"><audio id="audio" src="demo.mp3"></audio><button data-ui-language="en" translate="no">English</button><button data-ui-language="zh" translate="no">中文</button></body></html>',{url:'http://127.0.0.1:8768/',runScripts:'outside-only'});if(language)dom.window.localStorage.setItem('pocketman.language',language);dom.window.eval(source);return dom}
test('English defaults, Chinese round-trip and music metadata preservation',async t=>{const dom=fixture();t.after(()=>dom.window.close());const {document:d,PocketmanI18n:i}=dom.window;await tick();assert.equal(d.documentElement.lang,'en');assert.equal(d.querySelector('#play').textContent,'Play');assert.equal(d.querySelector('#play').getAttribute('aria-label'),'Play');for(const [selector,text]of [['#track-name','暂停'],['#rack-nameplate-title','我的磁带架'],['.cloud-row-info strong','停止'],['.cloud-row-info small','我的电台']])assert.equal(d.querySelector(selector).textContent,text);assert.equal(d.querySelector('#rack-editor-name').value,'外观');const audio=d.querySelector('#audio');audio.currentTime=12;audio.volume=.4;i.setLanguage('zh');assert.equal(d.documentElement.lang,'zh-CN');assert.equal(d.querySelector('#play').textContent,'播放');assert.equal(d.querySelector('[data-ui-language="zh"]').getAttribute('aria-pressed'),'true');i.setLanguage('en');assert.equal(d.querySelector('#play').textContent,'Play');assert.equal(d.querySelector('#audio'),audio);assert.equal(audio.currentTime,12);assert.equal(audio.volume,.4)});
test('Saved choice, switch button and messages created after initialization',async t=>{const dom=fixture('zh');t.after(()=>dom.window.close());const d=dom.window.document;await tick();assert.equal(d.documentElement.lang,'zh-CN');d.querySelector('[data-ui-language="en"]').click();assert.equal(dom.window.localStorage.getItem('pocketman.language'),'en');d.querySelector('#notice').textContent='网易云当前未登录或登录已失效，请重新扫码后再播放。';const button=d.createElement('button');button.textContent='重试播放';button.setAttribute('aria-label','装入 我的磁带架 磁带盒');d.body.append(button);await tick();assert.match(d.querySelector('#notice').textContent,/session is missing or expired/);assert.equal(button.textContent,'Retry playback');assert.equal(button.getAttribute('aria-label'),'Load 我的磁带架');d.querySelector('[data-ui-language="zh"]').click();assert.equal(button.textContent,'重试播放');assert.equal(button.getAttribute('aria-label'),'装入 我的磁带架 磁带盒');assert.match(d.querySelector('#notice').textContent,/登录已失效/)});
test('Loading, failure, count and native confirmation translations retain inserted names',()=>{assert.equal(translate('准备好了'),'Ready');assert.equal(translate('有些素材没能加载，请重试。'),'Some assets failed to load. Please try again.');assert.equal(translate('已加入 3 首歌曲'),'Added 3 songs.');assert.equal(translate('普通磁带架 · 1 首'),'Music rack · 1 track');assert.equal(translate('喜欢：播放（需云端歌曲）'),'Like: 播放 (cloud tracks only)');assert.equal(translate('移除「外观」？仅移除随身听中的列表，不影响音乐平台的歌单和收藏。'),"Remove “外观” from this player? Your music service playlists and favorites stay intact.");assert.equal(translate('歌曲名不应改变'),'歌曲名不应改变')});
test('Blocked local storage falls back to English and language switching still works',async t=>{const dom=fixture();t.after(()=>dom.window.close());Object.defineProperty(dom.window,'localStorage',{get(){throw new Error('blocked')}});assert.doesNotThrow(()=>dom.window.PocketmanI18n.setLanguage('zh'));assert.equal(dom.window.document.documentElement.lang,'zh-CN');assert.doesNotThrow(()=>dom.window.PocketmanI18n.setLanguage('en'));assert.equal(dom.window.document.documentElement.lang,'en')});

test('Printed artists, legacy track list and provider playlist names are never translated',async t=>{const dom=fixture();t.after(()=>dom.window.close());const d=dom.window.document;const region=d.createElement('section');region.innerHTML='<span class="print-artist">外观 · 我的电台</span><div id="track-list"><button class="track"><span>播放</span><small>停止</small></button></div><h3 id="cloud-results-title"></h3>';d.body.append(region);dom.window.PocketmanI18n.setNamedTitle(d.querySelector('#cloud-results-title'),'外观 · 我的电台',3);await tick();assert.equal(d.querySelector('.print-artist').textContent,'外观 · 我的电台');assert.equal(d.querySelector('.track span').textContent,'播放');assert.equal(d.querySelector('.track small').textContent,'停止');assert.equal(d.querySelector('#cloud-results-title').textContent,'外观 · 我的电台 · 3 tracks');dom.window.PocketmanI18n.setLanguage('zh');assert.equal(d.querySelector('#cloud-results-title').textContent,'外观 · 我的电台 · 3 首')});
test('QR retry suffix translates the nested error without changing unknown upstream detail',()=>{assert.equal(translate('连接超时，请检查网络后重试。 可刷新二维码重试。'),'Connection timed out. Check your network and try again. Refresh the QR code to try again.');assert.equal(translate('upstream detail X-42 可刷新二维码重试。'),'upstream detail X-42 Refresh the QR code to try again.')});

test('Paper card uses English demo notes, restores Chinese and preserves imported metadata',async t=>{
 const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
 const canvas=html.match(/<div class="music-tag-canvas">[\s\S]*?<\/dl><img[^>]+><\/div><\/div>/)[0];
 const dom=fixture();t.after(()=>dom.window.close());const w=dom.window,d=w.document;
 const tag=d.createElement('aside');tag.id='tape-booklet';tag.innerHTML=canvas;d.body.append(tag);
 const demo={title:'霓虹夜行',artist:'艺术家不详',album:'都会循环',src:'assets/neon-night.mp3',cover:''};
 w.notesTracks=[demo];
 const player=fs.readFileSync(path.join(__dirname,'../player.js'),'utf8');
 const render=player.slice(player.indexOf('function renderBooklet(){'),player.indexOf('// A fixed physical rack'));
 w.eval("var $=s=>document.querySelector(s),tracks=notesTracks,pulled=0,swapping=false,bookletArtworkVersion=0;"+render+';renderBooklet();');
 await tick();
 const notes=()=>['booklet-track-label','booklet-title','booklet-artist','booklet-album'].map(id=>d.getElementById(id).textContent);
 assert.deepEqual(notes(),['Track','Neon Night','Unknown Artist','City Loops']);
 assert.match(tag.querySelector('header').textContent,/TAPE NOTES/);
 assert.deepEqual([...tag.querySelectorAll('dt')].map(el=>el.textContent),['Artist','Album']);
 assert.equal(d.querySelector('#booklet-number').textContent,'01');
 assert.equal(d.querySelector('#booklet-art').getAttribute('alt'),'Selected tape artwork');
 w.PocketmanI18n.setLanguage('zh');await tick();
 assert.deepEqual(notes(),['曲目','霓虹夜行','艺术家不详','都会循环']);
 w.PocketmanI18n.setLanguage('en');await tick();
 assert.deepEqual(notes(),['Track','Neon Night','Unknown Artist','City Loops']);
 assert.equal(demo.title,'霓虹夜行');
 w.notesTracks[0]={...demo,src:'blob:imported-track',artist:'播放',album:'外观'};w.renderBooklet();await tick();
 assert.deepEqual(notes(),['Track','霓虹夜行','播放','外观']);
 w.PocketmanI18n.setLanguage('zh');w.PocketmanI18n.setLanguage('en');await tick();
 assert.deepEqual(notes(),['Track','霓虹夜行','播放','外观']);
});

test('Daily recommendation nameplate switches languages without changing saved or custom names',async t=>{
 const dom=fixture();t.after(()=>dom.window.close());const w=dom.window,d=w.document;
 const daily={name:'每日推荐',source:{provider:'netease',id:'daily'}};w.testRack=daily;
 const player=fs.readFileSync(path.join(__dirname,'../player.js'),'utf8');
 const render=player.slice(player.indexOf('function renderRackNameplate(){'),player.indexOf('function renderRack(){'));
 w.eval("var $=s=>document.querySelector(s),rackStore={rack:()=>testRack},fitCalls=0;function fitRackName(){fitCalls++}"+render+';renderRackNameplate();');
 await tick();const label=d.querySelector('#rack-nameplate-title');
 assert.equal(label.textContent,'Daily Picks');assert.equal(label.title,'Daily Picks');assert.equal(daily.name,'每日推荐');
 w.PocketmanI18n.setLanguage('zh');await tick();assert.equal(label.textContent,'每日推荐');
 w.PocketmanI18n.setLanguage('en');await tick();assert.equal(label.textContent,'Daily Picks');assert.equal(w.fitCalls,3);
 daily.nameIsCustom=true;w.renderRackNameplate();await tick();assert.equal(label.textContent,'每日推荐');
 delete daily.nameIsCustom;daily.name='周末精选';w.renderRackNameplate();await tick();assert.equal(label.textContent,'周末精选');
 daily.name='每日推荐';daily.source.id='12345';w.renderRackNameplate();await tick();assert.equal(label.textContent,'每日推荐');
 assert.equal(require('../i18n.js').rackName({name:'每日推荐'},'en'),'每日推荐');
});

test('Demo metadata is shared across cassette faces and UI without translating imported tracks',()=>{
 const {trackMetadata}=require('../i18n.js');
 const demo={src:'assets/neon-night.mp3',title:'霓虹夜行',artist:'艺术家不详',album:'都会循环',year:'不详',description:'霓虹夜行 · 都会循环版 · 原创演示曲'};
 const en=trackMetadata(demo,'en');assert.deepEqual([en.title,en.artist,en.album,en.description],['Neon Night','Unknown Artist','City Loops','Neon Night · City Loops edition · Original demo']);
 assert.equal(trackMetadata(demo,'zh'),demo);assert.equal(demo.title,'霓虹夜行');
 const imported={...demo,src:'blob:local-file'};assert.equal(trackMetadata(imported,'en'),imported);
 for(const origin of [{provider:'netease'},{provider:'apple'},{local:true}]){const external={...demo,...origin};assert.equal(trackMetadata(external,'en'),external)}
 for(const [cn,en]of [['ALBUM / 专辑','ALBUM'],['YEAR / 年份','YEAR'],['TIME / 时长','TIME']])assert.equal(translate(cn),en);
});

test('Shared cassette templates switch both ways and preserve album and artist values',async t=>{
 const dom=fixture();t.after(()=>dom.window.close());const w=dom.window,d=w.document;
 const player=fs.readFileSync(path.join(__dirname,'../player.js'),'utf8');
 const wrapper=d.createElement('section');wrapper.innerHTML=player.match(/backDetails\.innerHTML='([^']+)'/)[1]+player.match(/printDetails\.innerHTML='([^']+)'/)[1]+'<span id="rack-count">06 盘磁带</span>';
 wrapper.querySelector('.back-album').textContent='专辑';wrapper.querySelector('.back-artist').textContent='立体声';d.body.append(wrapper);await tick();
 const values=()=>[...wrapper.querySelectorAll('.back-caption,.print-footer,.print-stereo,#rack-count')].map(el=>el.textContent);
 assert.deepEqual(values(),['Album','YEAR','TIME','COMPACT CASSETTE','STEREO','06 TAPES']);
 assert.equal(wrapper.querySelector('.back-album').textContent,'专辑');assert.equal(wrapper.querySelector('.back-artist').textContent,'立体声');
 w.PocketmanI18n.setLanguage('zh');await tick();assert.deepEqual(values(),['专辑','年份','时长','COMPACT CASSETTE','STEREO','06 盘磁带']);
 w.PocketmanI18n.setLanguage('en');await tick();assert.deepEqual(values(),['Album','YEAR','TIME','COMPACT CASSETTE','STEREO','06 TAPES']);
});
