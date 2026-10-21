'use strict';
const path=require('node:path'),os=require('node:os'),{execFile}=require('node:child_process');
class Resources {
  constructor({root=path.resolve(__dirname,'..'),read,additional=()=>[],now=()=>performance.now()}={}){this.root=root;this.read=read||(()=>this.windows());this.additional=additional;this.now=now;this.previous=new Map();this.cache=null;this.at=0;this.ownStart='own-'+Math.round(Date.now()-process.uptime()*1000);}
  windows(){return new Promise((resolve,reject)=>{
    if(process.platform!=='win32')return resolve({partial:true,processes:[]});
    const executable=path.join(process.env.SystemRoot||'C:\\Windows','System32','WindowsPowerShell','v1.0','powershell.exe');
    execFile(executable,['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',path.join(this.root,'scripts','measure-resources.ps1'),'-InstallRoot',this.root],{windowsHide:true,timeout:5000,maxBuffer:256*1024,encoding:'utf8'},(error,stdout)=>{if(error)return reject(error);try{resolve(JSON.parse(stdout.replace(/^\uFEFF/,'')));}catch(e){reject(e);}});
  });}
  async sample(){
    if(this.cache&&this.now()-this.at<9000)return this.cache;if(this.inflight)return this.inflight;
    this.inflight=this.measure();try{return await this.inflight;}finally{this.inflight=null;}
  }
  async measure(){
    const at=this.now();let data;try{data=await this.read();}catch{data={partial:true,processes:[]};}
    const rows=Array.isArray(data.processes)?data.processes.slice(0,32):[],cpu=process.cpuUsage();
    for(const row of this.additional().slice(0,4))if(!rows.some(r=>r.pid===row.pid))rows.push(row);
    if(!rows.some(r=>r.pid===process.pid)){data.partial=true;rows.push({pid:process.pid,role:'server',start:this.ownStart,cpuTicks:String((cpu.user+cpu.system)*10),memoryBytes:process.memoryUsage().rss});}
    const known=new Map(),roles=new Set(['server','network-service','hardware-service','openrgb','effect-worker','hid-bridge','cooling-helper','tray']),processors=os.availableParallelism();
    const processes=[];for(const row of rows){if(!Number.isInteger(row.pid)||!roles.has(row.role)||!/^\d+$|^own-\d+$/.test(String(row.start))||!/^\d+$/.test(String(row.cpuTicks))||!Number.isSafeInteger(row.memoryBytes)||row.memoryBytes<0)continue;const key=row.pid+':'+row.start,ticks=Number(row.cpuTicks),old=this.previous.get(key);known.set(key,{ticks,at});processes.push({pid:row.pid,role:row.role,memoryMB:Math.round(row.memoryBytes/104857.6)/10,cpuPercent:old&&at>old.at&&ticks>=old.ticks?Math.round(Math.min(100,(ticks-old.ticks)/10000/(at-old.at)/processors*100)*10)/10:null});}
    this.previous=known;this.at=this.now();this.cache={at:new Date().toISOString(),processors,partial:Boolean(data.partial),processes,memoryMB:Math.round(processes.reduce((n,r)=>n+r.memoryMB,0)*10)/10,cpuPercent:processes.every(r=>r.cpuPercent!==null)?Math.round(processes.reduce((n,r)=>n+r.cpuPercent,0)*10)/10:null,measurementMs:Math.round(this.now()-at)};return this.cache;
  }
}
module.exports={Resources};
