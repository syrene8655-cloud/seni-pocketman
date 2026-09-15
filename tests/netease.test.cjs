const {test}=require('node:test'),assert=require('node:assert/strict');
const {createServer,cdnURL}=require('../server.cjs');
async function setup(t,call){const server=createServer({call});await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));const base='http://127.0.0.1:'+server.address().port;let cookie='';return {base,async post(route,body={}){const r=await fetch(base+'/api/netease/'+route,{method:'POST',headers:{'Content-Type':'application/json','X-Cassette-Client':'1',Cookie:cookie},body:JSON.stringify(body)});if(r.headers.get('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];return {status:r.status,data:await r.json()}}}}
test('allowlisted routes, same-origin protection, hidden source/dependencies',async t=>{const {base,post}=await setup(t,async()=>{throw Error('not called')});assert.equal((await fetch(base+'/server.cjs')).status,404);assert.equal((await fetch(base+'/node_modules/anything')).status,404);assert.equal((await fetch(base+'/api/netease/status',{method:'POST',headers:{Origin:'https://untrusted.example','X-Cassette-Client':'1'}})).status,403);assert.equal((await fetch(base+'/api/netease/status',{method:'POST'})).status,403);assert.equal((await post('song/url/match')).status,404);assert.equal((await post('stream',{id:'1,2'})).status,400)});
test('QR login stores upstream cookie only on server; logout revokes it',async t=>{const calls=[];const {post}=await setup(t,async(method,p)=>{calls.push({method,p});if(method==='login_qr_key')return {body:{data:{unikey:'test-key'}}};if(method==='login_qr_create')return {body:{data:{qrimg:'data:image/png;base64,fixture'}}};if(method==='login_qr_check')return {body:{code:803,cookie:'SECRET'},cookie:['MUSIC_U=SECRET; Path=/']};if(method==='login_status')return {body:{data:{profile:{userId:12,nickname:'测试用户'}}}};if(method==='user_playlist')return {body:{playlist:[],more:false}}});assert.equal((await post('playlists')).status,401);await post('qr');const login=await post('qr-check');assert.equal(login.data.profile.nickname,'测试用户');assert.ok(!JSON.stringify(login).includes('SECRET'));await post('playlists');assert.equal(calls.at(-1).p.cookie.MUSIC_U,'SECRET');await post('logout');assert.equal((await post('playlists')).status,401);assert.equal((await post('status')).data.profile,null)});
test('late QR check cannot sign in after logout',async t=>{let resolveCheck;const {post}=await setup(t,async method=>{if(method==='login_qr_key')return {body:{data:{unikey:'test-key'}}};if(method==='login_qr_create')return {body:{data:{qrimg:'qr'}}};if(method==='login_qr_check')return new Promise(r=>resolveCheck=r)});await post('qr');const pending=post('qr-check');while(!resolveCheck)await new Promise(r=>setImmediate(r));await post('logout');resolveCheck({body:{code:803},cookie:['MUSIC_U=SECRET']});assert.equal((await pending).data.code,800);assert.equal((await post('status')).data.profile,null)});
test('playlist uses full trackIds in pages rather than truncated tracks',async t=>{const {post}=await setup(t,async(method,p)=>method==='playlist_detail'?{body:{playlist:{name:'测试歌单',trackIds:Array.from({length:125},(_,i)=>({id:i+1})),tracks:[]}}}:{body:{songs:p.ids.split(',').map(id=>({id,name:'曲目 '+id,ar:[{name:'歌手'}],al:{name:'专辑',picUrl:'https://p1.music.126.net/art.jpg'}}))}});const first=await post('playlist',{id:1});assert.equal(first.data.items.length,50);assert.equal(first.data.total,125);assert.equal(first.data.more,true);const end=await post('playlist',{id:1,offset:100});assert.equal(end.data.items.length,25);assert.equal(end.data.more,false);assert.equal(end.data.items[0].id,'101');assert.match(end.data.items[0].cover,/^\/api\/netease\/image/)});
test('stream preserves trial flag and refuses absent/untrusted URL; no unlock',async t=>{let reply={url:'http://m7.music.126.net/song.mp3',freeTrialInfo:{start:0,end:30},expi:1200};const {post}=await setup(t,async(method,p)=>{assert.equal(p.unblock,'false');assert.equal(p.crypto,'eapi');return {body:{data:[reply]}}});const r=await post('stream',{id:1});assert.equal(r.data.trial,true);assert.match(r.data.url,/^https:/);reply={url:null};assert.equal((await post('stream',{id:1})).status,422);assert.equal(cdnURL('https://music.126.net.evil.example/x','audio'),null);assert.equal(cdnURL('http://127.0.0.1/x','image'),null);assert.equal(cdnURL('https://u:p@p1.music.126.net/x','image'),null)});
test('daily recommendations require login, preserve account cookies and actual metadata',async t=>{let songs=[{id:41,name:'每日歌曲',ar:[{name:'真实歌手'}],al:{name:'真实专辑',picUrl:'https://p1.music.126.net/cover.jpg'}}];let dailyCalls=0;
 const {post}=await setup(t,async(method,p)=>{if(method==='login_qr_key')return {body:{data:{unikey:'fixture'}}};if(method==='login_qr_create')return {body:{data:{qrimg:'qr'}}};if(method==='login_qr_check')return {body:{code:803},cookie:['MUSIC_U=TEST; Path=/']};if(method==='login_status')return {body:{data:{profile:{userId:12,nickname:'测试用户'}}}};if(method==='recommend_songs'){dailyCalls++;assert.equal(p.cookie.MUSIC_U,'TEST');return {body:{data:{dailySongs:songs}}}}});
 assert.equal((await post('daily')).status,401);assert.equal(dailyCalls,0);await post('qr');await post('qr-check');const r=await post('daily');assert.equal(r.status,200);assert.equal(r.data.items[0].artist,'真实歌手');assert.equal(r.data.items[0].album,'真实专辑');assert.equal(r.data.items[0].id,'41');assert.equal(r.data.more,false);assert.equal(r.data.total,1);assert.ok(r.data.date);songs=[];assert.equal((await post('daily')).data.items.length,0);await post('logout');assert.equal((await post('daily')).status,401);
});
test('likes read account state and mutations are validated, serialized, and confirmed',async t=>{
 let liked=new Set(['41']),code=200,hold=false,release,writeCalls=0;
 const {post}=await setup(t,async(method,p)=>{
  if(method==='login_qr_key')return {body:{data:{unikey:'fixture'}}};
  if(method==='login_qr_create')return {body:{data:{qrimg:'qr'}}};
  if(method==='login_qr_check')return {body:{code:803},cookie:['MUSIC_U=TEST; Path=/']};
  if(method==='login_status')return {body:{data:{profile:{userId:12,nickname:'测试用户'}}}};
  assert.equal(p.cookie.MUSIC_U,'TEST');
  if(method==='likelist'){assert.equal(p.uid,12);return {body:{code:200,ids:[...liked]}}}
  if(method==='like'){writeCalls++;assert.ok(['true','false'].includes(p.like));if(hold)await new Promise(r=>release=r);if(code===200){if(p.like==='true')liked.add(p.id);else liked.delete(p.id)}return {body:{code}}}
 });
 assert.equal((await post('likes')).status,401);assert.equal((await post('like',{id:'41',like:true})).status,401);assert.equal(writeCalls,0);
 await post('qr');await post('qr-check');assert.deepEqual((await post('likes')).data.ids,['41']);
 assert.equal((await post('like',{id:'41',like:'false'})).status,400);assert.equal((await post('like',{id:'41,42',like:true})).status,400);assert.equal(writeCalls,0);
 assert.deepEqual((await post('like',{id:'41',like:false})).data,{id:'41',liked:false});assert.deepEqual((await post('likes')).data.ids,[]);
 code=500;assert.equal((await post('like',{id:'42',like:true})).status,502);assert.deepEqual((await post('likes')).data.ids,[]);
 code=200;hold=true;const a=post('like',{id:'42',like:true});while(!release)await new Promise(setImmediate);const before=writeCalls;assert.equal((await post('like',{id:'43',like:true})).status,409);assert.equal(writeCalls,before);release();assert.equal((await a).data.liked,true);
 assert.deepEqual((await post('likes')).data.ids,['42']);await post('logout');assert.equal((await post('likes')).status,401);
});
test('parallel localhost ports cannot overwrite each other’s authenticated session',async t=>{
 const api=async method=>method==='login_qr_key'?{body:{data:{unikey:'fixture'}}}:method==='login_qr_create'?{body:{data:{qrimg:'qr'}}}:method==='login_qr_check'?{body:{code:803},cookie:['MUSIC_U=TEST; Path=/']}:{body:{data:{profile:{userId:12,nickname:'测试用户'}}}};
 const a=await setup(t,api),b=await setup(t,api),jar=new Map();
 const request=async(base,route)=>{const r=await fetch(base+'/api/netease/'+route,{method:'POST',headers:{'X-Cassette-Client':'1','Content-Type':'application/json',Cookie:[...jar].map(([k,v])=>k+'='+v).join('; ')},body:'{}'});const cookie=r.headers.get('set-cookie');if(cookie){const [name,value]=cookie.split(';')[0].split('=');jar.set(name,value)}return r.json()};
 await request(a.base,'qr');await request(a.base,'qr-check');assert.equal((await request(a.base,'status')).profile.nickname,'测试用户');await request(b.base,'status');assert.equal(jar.size,2);assert.equal((await request(a.base,'status')).profile.nickname,'测试用户');assert.equal((await request(b.base,'status')).profile,null);
});

test('my playlists lists only account-created playlists; saved playlists remain accessible by explicit ID',async t=>{
 const {post}=await setup(t,async method=>{
  if(method==='login_qr_key')return {body:{data:{unikey:'fixture'}}};
  if(method==='login_qr_create')return {body:{data:{qrimg:'qr'}}};
  if(method==='login_qr_check')return {body:{code:803},cookie:['MUSIC_U=TEST; Path=/']};
  if(method==='login_status')return {body:{data:{profile:{userId:12,nickname:'测试用户'}}}};
  if(method==='user_playlist')return {body:{playlist:[{id:1,name:'Own',creator:{userId:12}},{id:2,name:'Saved',creator:{userId:99}},{id:3,name:'Unknown'}],more:true}};
  if(method==='playlist_detail')return {body:{playlist:{name:'Shared',trackIds:[]}}};
 });
 await post('qr');await post('qr-check');const r=await post('playlists');assert.deepEqual(r.data.items.map(p=>p.id),['1']);assert.equal(r.data.more,true);assert.equal((await post('playlist',{id:2})).data.name,'Shared');
});
