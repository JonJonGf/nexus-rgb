'use strict';
const {spawn}=require('node:child_process'),path=require('node:path'),fs=require('node:fs');

// The native v1 protocol replies in order. Only one request may be in flight.
// A timeout destroys that generation so late replies cannot complete another command.
class HidBridge {
  constructor({binaryPath=null,isTest,spawnProcess=spawn,timeoutMs=4000,maxPending=64}={}) {
    this.isTest=isTest ?? (process.env.NODE_ENV==='test'||Boolean(process.env.NODE_TEST_CONTEXT)||process.execArgv.includes('--test'));
    const candidates=[binaryPath,path.resolve(__dirname,'../../nexus-hid.exe'),path.resolve(__dirname,'../nexus-hid.exe'),path.resolve(__dirname,'../../dist/native/nexus-hid.exe'),path.resolve(__dirname,'../../native/nexus-hid.exe')].filter(Boolean);
    this.binaryPath=candidates.find(p=>fs.existsSync(p))||candidates[0];
    this.spawnProcess=spawnProcess;this.timeoutMs=timeoutMs;this.maxPending=maxPending;
    this.process=null;this.ready=false;this.pendingCallbacks=[];this.active=null;this.buffer='';this.lastError=null;this.retryAt=0;
  }
  start() {
    if(this.process)return;
    if(Date.now()<this.retryAt)throw Error('A ponte USB está aguardando uma nova tentativa.');
    if(!fs.existsSync(this.binaryPath))throw Error('A ponte USB não está instalada.');
    const child=this.spawnProcess(this.binaryPath,[],{windowsHide:true,stdio:['pipe','pipe','ignore']});
    this.process=child;this.ready=false;
    this.startupTimer=setTimeout(()=>{if(this.process===child)this.stop(Error('A ponte USB não iniciou no prazo.'));},this.timeoutMs);
    child.stdout.on('data',chunk=>{
      if(this.process!==child)return;
      this.buffer+=chunk.toString('utf8').replace(/^\uFEFF/,'');
      if(Buffer.byteLength(this.buffer)>1024*1024)return this.stop(Error('Resposta USB acima do limite.'));
      const lines=this.buffer.split('\n');this.buffer=lines.pop()||'';
      for(const line of lines){
        if(this.process!==child)return;
        if(!line.trim())continue;
        let response;try{response=JSON.parse(line);}catch{return this.stop(Error('Resposta inválida da ponte USB.'));}
        if(response?.status==='ready'){this.ready=true;clearTimeout(this.startupTimer);this.flush();continue;}
        const request=this.active;if(!request)return this.stop(Error('Resposta USB sem comando correspondente.'));
        this.active=null;clearTimeout(request.timer);
        if(response?.status==='error')request.reject(Error('Falha USB: '+String(response.message||'comando recusado').slice(0,80)));
        else request.resolve(response);
        this.flush();
      }
    });
    const failed=()=>{if(this.process===child)this.stop(Error('A ponte USB encerrou a comunicação.'));};
    child.on('error',failed);child.on('exit',failed);child.stdin.on('error',failed);
    child.stdin.on('drain',()=>{if(this.process===child)this.flush();});
  }
  flush(){
    if(!this.ready||this.active||!this.process||this.process.stdin.writableLength>65536)return;
    const request=this.pendingCallbacks.shift();if(!request)return;
    this.active=request;
    request.timer=setTimeout(()=>this.stop(Error('O dispositivo USB não respondeu no prazo.')),this.timeoutMs);
    try{this.process.stdin.write(JSON.stringify(request.payload)+'\n');}catch(error){this.stop(error);}
  }
  request(payload){
    if(this.isTest)return Promise.resolve(payload.action==='enumerate'?[]:{status:'mock'});
    return new Promise((resolve,reject)=>{
      if(this.pendingCallbacks.length+(this.active?1:0)>=this.maxPending)return reject(Error('A fila USB atingiu o limite.'));
      try{this.start();}catch(error){this.lastError=error.message;reject(error);return;}
      this.pendingCallbacks.push({payload,resolve,reject});this.flush();
    });
  }
  sendCommand(payload,callback=()=>{}){this.request(payload).then(value=>callback(null,value),error=>callback(error,null));}
  async sendFeatureReport(devicePath,buffer){const res=await this.request({action:'set_feature',path:devicePath,hex:buffer.toString('hex')});return res?.status==='ok'||res?.status==='mock';}
  async writeOutputReport(devicePath,buffer){const res=await this.request({action:'write',path:devicePath,hex:buffer.toString('hex')});if(res?.status==='ok'&&res.written!==undefined&&res.written!==buffer.length)throw Error('Escrita USB incompleta.');return res?.status==='ok'||res?.status==='mock';}
  async getFeatureReport(devicePath,reportIdOrBuffer,length=65){
    if(!Number.isInteger(length)||length<1||length>4096)throw Error('Tamanho de relatório USB inválido.');
    const hex=Buffer.isBuffer(reportIdOrBuffer)?reportIdOrBuffer.toString('hex'):Buffer.from([reportIdOrBuffer||0]).toString('hex');
    const res=await this.request({action:'get_feature',path:devicePath,hex,length:String(length)});
    return res?.status==='ok'&&typeof res.hex==='string'?Buffer.from(res.hex,'hex'):null;
  }
  async enumerate(){const response=await this.request({action:'enumerate'});if(!Array.isArray(response))throw Error('Lista de dispositivos USB inválida.');return response;}
  stop(error=null){
    const child=this.process;this.process=null;this.ready=false;this.buffer='';clearTimeout(this.startupTimer);
    if(error){this.lastError=error.message;this.retryAt=Date.now()+1000;}
    const failure=error||Error('Ponte USB encerrada.');
    if(this.active){clearTimeout(this.active.timer);this.active.reject(failure);this.active=null;}
    for(const request of this.pendingCallbacks.splice(0))request.reject(failure);
    try{child?.kill();}catch{}
  }
}
module.exports={HidBridge};
