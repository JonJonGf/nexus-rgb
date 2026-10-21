'use strict';
const fs=require('node:fs'),path=require('node:path'),net=require('node:net'),crypto=require('node:crypto');
const {spawn,execFile}=require('node:child_process');
// No RGB socket, no permanent service: the development helper exists only on demand.
class CoolingBridge {
  constructor({simulated=false,allowHardware=false,binaryPath=path.resolve(__dirname,'../dist/cooling/nexus-cooling.exe'),timeoutMs=5000}={}){
    this.simulated=simulated;this.allowHardware=allowHardware;this.binaryPath=binaryPath;this.timeoutMs=timeoutMs;
    this.pending=new Map();this.nextId=1;this.buffer='';this.ready=false;this.closed=false;
  }
  start(){
    if(this.starting)return this.starting;
    this.starting=new Promise((resolve,reject)=>{
      if(this.closed)return reject(Error('Auxiliar de ventilação encerrado.'));
      if(!this.simulated&&!this.allowHardware)return reject(Error('Abra a versão de desenvolvimento de ventilação para detectar sensores.'));
      if(process.platform!=='win32'||!fs.existsSync(this.binaryPath))return reject(Error('Compile o auxiliar de ventilação de desenvolvimento antes de iniciar.'));
      this.readyReject=reject;
      this.startTimer=setTimeout(()=>this.fail(Error('O auxiliar de ventilação não iniciou no prazo.')),this.simulated?5000:70000);
      const attach=stream=>{
        this.stream=stream;stream.on('data',chunk=>{
          this.buffer+=chunk.toString('utf8').replace(/^\uFEFF/,'');
          if(Buffer.byteLength(this.buffer)>512*1024)return this.fail(Error('Resposta de ventilação acima do limite.'));
          let pos;
          while((pos=this.buffer.indexOf('\n'))>=0){
            const line=this.buffer.slice(0,pos);this.buffer=this.buffer.slice(pos+1);if(!line.trim())continue;
            let value;try{value=JSON.parse(line);}catch{return this.fail(Error('Resposta de ventilação inválida.'));}
            if(value.status==='ready'&&!this.ready){
              if(!Number.isInteger(value.pid)||value.pid<=0||this.child&&value.pid!==this.child.pid)return this.fail(Error('Identidade do auxiliar de ventilação inválida.'));
              this.pid=value.pid;this.ready=true;clearTimeout(this.startTimer);this.readyReject=null;resolve();continue;
            }
            const request=this.pending.get(value.id);if(!request)return this.fail(Error('Resposta de ventilação fora de sequência.'));
            clearTimeout(request.timer);this.pending.delete(value.id);
            if(value.status==='error')request.reject(Error(String(value.message||'Comando de ventilação recusado.').slice(0,180)));
            else if(value.status==='ok')request.resolve(value.data);
            else this.fail(Error('Resposta de ventilação inválida.'));
          }
        });
        stream.on('error',()=>this.fail(Error('A comunicação de ventilação foi interrompida.')));
        stream.on('end',()=>this.fail(Error('O auxiliar de ventilação foi encerrado.')));
      };
      if(this.simulated){
        const child=spawn(this.binaryPath,['--fixture','--parent',String(process.pid)],{windowsHide:true,stdio:['pipe','pipe','ignore']});
        this.child=child;this.writer=child.stdin;attach(child.stdout);
        child.on('error',()=>this.fail(Error('Não foi possível iniciar o auxiliar simulado.')));
        child.on('exit',()=>this.fail(Error('O auxiliar de ventilação foi encerrado.')));
        child.stdin.on('error',()=>this.fail(Error('A comunicação de ventilação foi interrompida.')));
      }else{
        const pipe='NexusRGB.Cooling.Dev.'+crypto.randomBytes(16).toString('hex');
        const literal=value=>"'"+value.replaceAll("'","''")+"'";
        // Only trusted startup options reach this command; request bodies cannot choose paths/arguments.
        const command='Start-Process -FilePath '+literal(this.binaryPath)+' -ArgumentList '+literal('--hardware --pipe '+pipe+' --parent '+process.pid)+' -Verb RunAs -WindowStyle Hidden';
        execFile(path.join(process.env.SystemRoot||'C:\\Windows','System32/WindowsPowerShell/v1.0/powershell.exe'),['-NoProfile','-NonInteractive','-Command',command],{windowsHide:true,timeout:65000},error=>{if(error&&!this.ready)this.fail(Error('O acesso de administrador à ventilação não foi autorizado.'));});
        const connect=()=>{
          if(this.closed||this.ready)return;
          const socket=net.connect('\\\\.\\pipe\\'+pipe);
          socket.once('connect',()=>{this.writer=socket;attach(socket);});
          socket.once('error',error=>{
            if(this.stream===socket)return;
            if(!this.closed&&['ENOENT','EBUSY','ECONNREFUSED'].includes(error.code))this.retry=setTimeout(connect,200);
            else this.fail(Error('Não foi possível conectar ao auxiliar de ventilação.'));
          });
          this.socket=socket;
        };connect();
      }
    });
    return this.starting;
  }
  async request(body){
    if(this.closed)throw Error('Auxiliar de ventilação encerrado.');
    await this.start();
    if(this.closed||this.pending.size>=4||this.writer.writableLength>65536)throw Error('O auxiliar de ventilação está ocupado.');
    return new Promise((resolve,reject)=>{
      const id=this.nextId++;const timer=setTimeout(()=>this.fail(Error('O auxiliar de ventilação não respondeu no prazo.')),this.timeoutMs);
      this.pending.set(id,{resolve,reject,timer});
      try{this.writer.write(JSON.stringify({...body,id})+'\n');}catch{this.fail(Error('Falha ao enviar comando de ventilação.'));}
    });
  }
  fail(error){
    if(this.closed)return;
    this.closed=true;clearTimeout(this.startTimer);clearTimeout(this.retry);this.readyReject?.(error);this.readyReject=null;
    for(const request of this.pending.values()){clearTimeout(request.timer);request.reject(error);}this.pending.clear();
    // EOF lets the native helper release owned channels; never force-kill a real fan controller.
    try{this.writer?.end();}catch{}try{this.socket?.destroy();}catch{}
  }
  async close(){
    if(!this.closed&&this.ready){try{await this.request({action:'shutdown'});}catch{}}
    this.fail(Error('Auxiliar de ventilação encerrado.'));
    if(this.child&&this.child.exitCode===null&&this.child.signalCode===null){await new Promise(resolve=>{const timer=setTimeout(resolve,1500);this.child.once('exit',()=>{clearTimeout(timer);resolve();});});}
  }
  cancel(){this.fail(Error('Inicialização de ventilação cancelada.'));}
}
module.exports={CoolingBridge};
