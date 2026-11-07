'use strict';
const fs=require('node:fs'),path=require('node:path');
// The installed service accepts only an explicit payload matching its build.
// No request body or persisted user setting can select an executable or launcher.
function installedCooling(root){
  try{
    const build=JSON.parse(fs.readFileSync(path.join(root,'server/build-info.json'),'utf8'));
    const development=build.development===true&&build.tag===null;
    const alpha=build.development===false&&typeof build.tag==='string'&&/^v\d+\.\d+\.\d+-alpha\.[1-9]\d*$/.test(build.tag);
    const stable=build.development===false&&typeof build.version==='string'&&/^[1-9]\d*\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(build.version)&&build.tag==='v'+build.version;
    const legacy=development&&!fs.existsSync(path.join(root,'server/cooling-package.json'));
    const marker=JSON.parse(fs.readFileSync(path.join(root,'server',legacy?'cooling-development.json':'cooling-package.json'),'utf8'));
    const binaryPath=path.join(root,'cooling/nexus-cooling.exe');
    if((!development&&!alpha&&!stable)||! /^[a-f0-9]{40}$/.test(build.commit)||
      marker.format!==(legacy?'nexus-cooling-development/1':'nexus-cooling-package/1')||marker.commit!==build.commit||!fs.statSync(binaryPath).isFile())return {};
    return {allowHardware:true,brokered:true,serviceBroker:'NexusRGB.Cooling.Launch.v1',binaryPath};
  }catch{return {};}
}
module.exports={installedCooling};
