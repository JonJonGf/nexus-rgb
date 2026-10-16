'use strict';
const fs=require('node:fs'),path=require('node:path');
function about() {
  const fallback={version:require('../package.json').version,tag:null,commit:null,development:true};
  try {
    const data=JSON.parse(fs.readFileSync(path.join(__dirname,'build-info.json'),'utf8'));
    if(data.version!==fallback.version||!(/^[a-f0-9]{40}$/.test(data.commit||''))||typeof data.development!=='boolean'||data.tag!==null&&!/^v\d+\.\d+\.\d+(?:-(?:alpha|beta|rc)\.\d+)?$/.test(data.tag))return fallback;
    return {version:data.version,tag:data.tag,commit:data.commit,development:data.development};
  }catch{return fallback;}
}
module.exports={about};
