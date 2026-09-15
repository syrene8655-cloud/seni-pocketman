'use strict';
const {isIP}=require('node:net');
// The service stays on loopback. Only a local reverse proxy may supply client IPs.
function serverPolicy(options={}){
 const configured=options.publicOrigin??process.env.WALKMAN_PUBLIC_ORIGIN??'';
 let publicURL=null;
 if(configured){try{publicURL=new URL(configured)}catch{throw Error('WALKMAN_PUBLIC_ORIGIN 必须是 HTTPS 域名。')}
  if(publicURL.protocol!=='https:'||publicURL.origin!==configured||publicURL.username||publicURL.password||isIP(publicURL.hostname))throw Error('WALKMAN_PUBLIC_ORIGIN 必须是没有路径的 HTTPS 域名。');
 }
 const buckets=new Map(),limit=options.rateLimit??180,maxActive=options.maxActive??48;let active=0;
 const loopback=ip=>['127.0.0.1','::1','::ffff:127.0.0.1'].includes(ip);
 return {publicURL,
  origin(req){const host=req.headers.host;if(publicURL)return host===publicURL.host&&loopback(req.socket.remoteAddress)?publicURL.origin:null;return /^127\.0\.0\.1:\d+$/.test(host||'')?'http://'+host:null},
  admit(req){const now=Date.now(),forwarded=req.headers['x-real-ip'];const ip=publicURL&&loopback(req.socket.remoteAddress)&&isIP(forwarded||'')?forwarded:req.socket.remoteAddress;
   for(const [k,v] of buckets)if(v.until<=now)buckets.delete(k);
   let b=buckets.get(ip);if(!b){if(buckets.size>=10000)return false;b={count:0,until:now+60000};buckets.set(ip,b)}
   if(++b.count>limit||active>=maxActive)return false;active++;return true;
  },release(){active=Math.max(0,active-1)}
 };
}
module.exports={serverPolicy};
