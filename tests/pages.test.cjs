'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {buildPages}=require('../scripts/build-pages.cjs');
test('Pages artifact marks static hosting and excludes backend and private files',t=>{
 const out=fs.mkdtempSync(path.join(os.tmpdir(),'pocketman-pages-'));t.after(()=>fs.rmSync(out,{recursive:true,force:true}));
 buildPages(out);const html=fs.readFileSync(path.join(out,'index.html'),'utf8');assert.match(html,/data-hosting="pages"/);
 assert.doesNotMatch(fs.readFileSync(path.join(__dirname,'../index.html'),'utf8'),/data-hosting="pages"/);
 for(const file of ['player.js','i18n.js','assets/neon-night.mp3','vendor/jsmediatags.min.js','LICENSE.md'])assert.ok(fs.existsSync(path.join(out,file)),file);
 for(const file of ['server.cjs','node_modules','private','.git','.github','package-lock.json'])assert.equal(fs.existsSync(path.join(out,file)),false,file);
 for(const [,relative]of html.matchAll(/(?:src|href)="([^"?#]+)(?:[?#][^"]*)?"/g))if(!/^(?:https?:|#)/.test(relative))assert.ok(fs.existsSync(path.join(out,relative)),relative);
});
