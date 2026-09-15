'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const configFile=process.env.WALKMAN_MUSICKIT_CONFIG||path.resolve(__dirname,'private/musickit/config.json');
function developerToken(origin,file=configFile){
 let c,key;try{c=JSON.parse(fs.readFileSync(file,'utf8'));key=crypto.createPrivateKey(fs.readFileSync(path.resolve(path.dirname(file),c.private_key_path)))}catch{throw Object.assign(new Error('Apple Music 私钥尚未配置，请检查本机 musickit/config.json。'),{status:503})}
 if(!/^[A-Z0-9]{10}$/.test(c.key_id)||!/^[A-Z0-9]{10}$/.test(c.team_id)||key.asymmetricKeyType!=='ec'||key.asymmetricKeyDetails?.namedCurve!=='prime256v1')throw Object.assign(new Error('Apple Music 密钥配置无效。'),{status:503});
 const now=Math.floor(Date.now()/1000),enc=v=>Buffer.from(JSON.stringify(v)).toString('base64url');
 const content=enc({alg:'ES256',kid:c.key_id})+'.'+enc({iss:c.team_id,iat:now-30,exp:now+3600,origin:[origin]});
 const signature=crypto.sign('sha256',Buffer.from(content),{key,dsaEncoding:'ieee-p1363'}).toString('base64url');
 return {developerToken:content+'.'+signature,expiresAt:(now+3600)*1000};
}
function appleImageURL(value){try{const u=new URL(value);return u.protocol==='https:'&&!u.port&&!u.username&&!u.password&&u.hostname.endsWith('.mzstatic.com')?u.href:null}catch{return null}}
module.exports={developerToken,appleImageURL};
