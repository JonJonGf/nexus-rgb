'use strict';
const fs=require('node:fs'),path=require('node:path');
// The installed service accepts only the optional, matching development payload.
// No request body or persisted user setting can select an executable or launcher.
function installedCooling(root){
  try{
    const build=JSON.parse(fs.readFileSync(path.join(root,'server/build-info.json'),'utf8'));
    const marker=JSON.parse(fs.readFileSync(path.join(root,'server/cooling-development.json'),'utf8'));
    const binaryPath=path.join(root,'cooling/nexus-cooling.exe');
    if(build.development!==true||build.tag!==null||! /^[a-f0-9]{40}$/.test(build.commit)||
      marker.format!=='nexus-cooling-development/1'||marker.commit!==build.commit||!fs.statSync(binaryPath).isFile())return {};
    return {allowHardware:true,brokered:true,serviceBroker:'NexusRGB.Cooling.Launch.v1',binaryPath};
  }catch{return {};}
}
module.exports={installedCooling};
