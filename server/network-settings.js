'use strict';
const path=require('node:path'),network=require('./network');
const {readJson,writeJson}=require('./store');

class NetworkSettings {
  constructor(directory,getInterfaces){
    this.file=path.join(directory,'network.json');this.getInterfaces=getInterfaces;this.address='';
    try{const saved=readJson(this.file,{address:''});if(saved&&typeof saved.address==='string'&&network.privateIp(saved.address))this.address=saved.address;}catch{}
  }
  resolve(port){
    const addresses=this.getInterfaces(),chosen=network.selectAdapter(addresses,this.address);
    return {addresses,chosen,selectedAddress:chosen?.address||null,lanUrl:chosen?`http://${chosen.address}:${port}/`:null};
  }
  set(address){
    if(typeof address!=='string'||address!==''&&!network.privateIp(address))throw Error('Endereço de rede inválido.');
    if(address!==''&&!this.getInterfaces().some(a=>a.address===address))throw Error('Endereço de rede indisponível.');
    writeJson(this.file,{address});this.address=address;
  }
}
module.exports={NetworkSettings};
