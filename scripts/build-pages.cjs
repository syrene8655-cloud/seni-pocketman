'use strict';
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
function buildPages(output=path.join(root,'.pages-site')){
 fs.mkdirSync(output,{recursive:true});
 // Publish frontend assets only. Server code, dependencies and private config stay out.
 const files=['index.html','style.css','LICENSE.md','THIRD_PARTY_NOTICES.md',...[...fs.readFileSync(path.join(root,'index.html'),'utf8').matchAll(/<script[^>]+src="([^"?#]+)(?:[^"]*)"/g)].map(match=>match[1]).filter(name=>!name.includes('/')&&name.endsWith('.js'))];
 for(const name of files)fs.copyFileSync(path.join(root,name),path.join(output,name));
 for(const name of ['assets','vendor'])fs.cpSync(path.join(root,name),path.join(output,name),{recursive:true,dereference:false});
 const entry=path.join(output,'index.html');fs.writeFileSync(entry,fs.readFileSync(entry,'utf8').replace('<html lang="en">','<html lang="en" data-hosting="pages">'));
 fs.writeFileSync(path.join(output,'.nojekyll'),'');
 return output;
}
if(require.main===module)console.log(buildPages());
module.exports={buildPages};
