'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {resolvePlaylistShare}=require('../netease-share.cjs');
const {createServer}=require('../server.cjs');
const redirect=url=>new Response(null,{status:302,headers:{location:url}});
test('Desktop, mobile long URLs and full share text resolve without network',async()=>{
 for(const value of ['123','https://music.163.com/playlist?id=123','https://music.163.com/#/playlist?id=123&userid=99','https://y.music.163.com/m/playlist?id=123','https://music.163.com/playlist/123','分享歌单: 吃饭用 https://music.163.com/m/playlist?id=123 (@网易云音乐)'])assert.equal(await resolvePlaylistShare(value,{fetchImpl:()=>{throw Error('unexpected network')}}),'123');
});
test('Phone short link expands using HEAD with no account cookie',async()=>{
 const calls=[];assert.equal(await resolvePlaylistShare('分享歌单: 吃饭用 https://163cn.tv/abc123 (@网易云音乐)',{fetchImpl:async(url,options)=>{calls.push({url,options});return redirect('https://music.163.com/m/playlist?id=6745211312')}}),'6745211312');
 assert.equal(calls.length,1);assert.equal(calls[0].options.method,'HEAD');assert.equal(calls[0].options.redirect,'manual');assert.equal(calls[0].options.headers,undefined);assert(calls[0].options.signal instanceof AbortSignal);
});
test('Redirects cannot request arbitrary hosts, credentials, ports or protocols',async()=>{
 for(const target of ['http://127.0.0.1/private','https://music.163.com.evil.test/playlist?id=123','https://user:pass@music.163.com/playlist?id=123','https://music.163.com:8888/playlist?id=123','file:///etc/passwd']){let count=0;await assert.rejects(resolvePlaylistShare('https://163cn.tv/abc',{fetchImpl:async()=>{count++;return redirect(target)}}));assert.equal(count,1)}
});
test('Wrong resource types, invalid IDs, multiple links and oversized text fail',async()=>{
 for(const value of ['https://music.163.com/song?id=123','https://music.163.com/album?id=123','https://music.163.com/user/home?id=123','https://music.163.com/playlist?id=-1','https://evil.test/playlist?id=123','https://163cn.tv/a https://163cn.tv/b','x'.repeat(2001)])await assert.rejects(resolvePlaylistShare(value));
});
test('Expired, looping and failed short links provide actionable errors',async()=>{
 await assert.rejects(resolvePlaylistShare('https://163cn.tv/a',{fetchImpl:async()=>new Response(null,{status:404})}),/重新分享/);
 let n=0;await assert.rejects(resolvePlaylistShare('https://163cn.tv/a',{fetchImpl:async()=>{n++;return redirect('/a')}}),/跳转过多/);assert.equal(n,4);
 await assert.rejects(resolvePlaylistShare('https://163cn.tv/a',{fetchImpl:async()=>{throw Error('timeout')}}),/浏览器打开后/);
});
test('Resolve route preserves origin guards, no-store and module isolation',async t=>{
 const server=createServer({call:async()=>{throw Error('unexpected account API')}},{shareFetch:async()=>redirect('https://music.163.com/m/playlist?id=123')});await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));const origin='http://127.0.0.1:'+server.address().port;
 const options={method:'POST',headers:{'Content-Type':'application/json','X-Cassette-Client':'1'},body:JSON.stringify({value:'分享 https://163cn.tv/abc (@网易云音乐)'})};
 const response=await fetch(origin+'/api/netease/resolve-playlist',options);assert.equal(response.status,200);assert.deepEqual(await response.json(),{id:'123'});assert.equal(response.headers.get('cache-control'),'no-store');assert.equal(response.headers.get('set-cookie'),null);
 assert.equal((await fetch(origin+'/api/netease/resolve-playlist',{...options,headers:{...options.headers,Origin:'https://evil.test'}})).status,403);assert.equal((await fetch(origin+'/netease-share.cjs')).status,404);
});
