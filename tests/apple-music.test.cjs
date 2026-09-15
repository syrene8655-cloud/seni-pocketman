'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {developerToken,appleImageURL}=require('../apple-music.cjs');
const {createServer}=require('../server.cjs');
test('MusicKit signing uses ES256, fixed origin and one-hour lifetime; private key stays server-side',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'walkman-signing-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const {privateKey,publicKey}=crypto.generateKeyPairSync('ec',{namedCurve:'prime256v1'});
 fs.writeFileSync(path.join(dir,'key.p8'),privateKey.export({type:'pkcs8',format:'pem'}));
 fs.writeFileSync(path.join(dir,'config.json'),JSON.stringify({key_id:'ABCDEFGHIJ',team_id:'0123456789',private_key_path:'key.p8'}));
 const result=developerToken('http://127.0.0.1:8766',path.join(dir,'config.json'));
 const [header,payload,signature]=result.developerToken.split('.'),claims=JSON.parse(Buffer.from(payload,'base64url'));
 assert.equal(JSON.parse(Buffer.from(header,'base64url')).alg,'ES256');assert.deepEqual(claims.origin,['http://127.0.0.1:8766']);assert.ok(claims.exp-claims.iat<=3630);
 assert.equal(crypto.verify('sha256',Buffer.from(header+'.'+payload),{key:publicKey,dsaEncoding:'ieee-p1363'},Buffer.from(signature,'base64url')),true);
 assert.equal(JSON.stringify(result).includes('PRIVATE KEY'),false);
 assert.throws(()=>developerToken('http://127.0.0.1:8766',path.join(dir,'missing.json')),/尚未配置/);
});
test('Apple image proxy admits only HTTPS Apple artwork hosts',()=>{
 assert.equal(appleImageURL('https://is1-ssl.mzstatic.com/image/a.jpg'),'https://is1-ssl.mzstatic.com/image/a.jpg');
 for(const url of ['http://is1-ssl.mzstatic.com/a','https://evil.test/a','https://mzstatic.com.evil.test/a','https://u:p@is1-ssl.mzstatic.com/a','https://is1-ssl.mzstatic.com:444/a','file:///etc/passwd'])assert.equal(appleImageURL(url),null);
});
test('Apple token route rejects cross-origin or unmarked requests and never serves config files',async t=>{
 const s=createServer({close(){},call(){throw new Error('unused')}});await new Promise(r=>s.listen(0,'127.0.0.1',r));t.after(()=>s.close());const base='http://127.0.0.1:'+s.address().port;
 for(const options of [{method:'GET'},{method:'POST'},{method:'POST',headers:{'X-Cassette-Client':'1',Origin:'https://evil.test'}},{method:'POST',headers:{'X-Cassette-Client':'1','Sec-Fetch-Site':'cross-site'}}])assert.equal((await fetch(base+'/api/apple-music/token',options)).status,403);
 for(const route of ['/musickit/config.json','/apple-music.cjs','/server.cjs','/../musickit/config.json'])assert.equal((await fetch(base+route)).status,404);
 assert.equal((await fetch(base+'/apple-music.js')).status,200);
 const page=await fetch(base+'/');assert.equal(page.headers.get('referrer-policy'),'strict-origin-when-cross-origin');
 const html=await page.text();assert.match(html,/<meta name="referrer" content="strict-origin-when-cross-origin">/);
 assert.ok(html.indexOf('name="referrer"')<html.indexOf('<script')); 
});
