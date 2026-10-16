'use strict';
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),target=path.resolve(process.argv[2]||'dist/app');
if(target!==path.join(root,'dist','app'))throw Error('Build stamp target must be dist/app.');
const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','ignore']}).trim();
const commit=git('rev-parse','HEAD'),dirty=Boolean(git('status','--porcelain','--untracked-files=normal'));
let tag=null;if(!dirty){try{const exact=git('describe','--tags','--exact-match','HEAD');if(/^v\d+\.\d+\.\d+(?:-(?:alpha|beta|rc)\.\d+)?$/.test(exact))tag=exact;}catch{}}
const data={version:require('../package.json').version,tag,commit,development:!tag||dirty};
fs.writeFileSync(path.join(target,'server','build-info.json'),JSON.stringify(data,null,2)+'\n');
