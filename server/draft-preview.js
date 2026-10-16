'use strict';
const crypto=require('node:crypto'),schema=require('./studio-schema');
// One transient worker, no files, controller access or active-effect changes.
class DraftPreview {
  constructor(studio,{startupMs=6000,frameMs=1000,lifetimeMs=300000,idleMs=15000}={}){this.studio=studio;this.limits={startupMs,frameMs,lifetimeMs,idleMs};this.current=null;this.closed=false;}
  async create(source,values={}){
    if(this.closed)throw Error('O aplicativo está encerrando.');
    if(this.current&&!this.current.ready)throw Error('Aguarde a validação da prévia.');
    const effect=this.studio.parse(source),selected=schema.parameters(effect,values);this.stop();
    const child=this.studio.spawn(),draft=this.current={token:crypto.randomBytes(24).toString('hex'),child,ready:false,busy:false,client:null};
    const fail=message=>{if(this.current===draft)this.stop(message);};
    try{
      await new Promise((resolve,reject)=>{
        draft.reject=reject;draft.deadline=setTimeout(()=>fail('A prévia demorou para responder.'),this.limits.startupMs);
        child.on('error',()=>fail('O processo da prévia falhou.'));child.on('exit',()=>fail('O processo da prévia encerrou.'));
        child.on('message',message=>{
          if(this.current!==draft)return;
          if(message.kind==='failure')return this.stop(String(message.error||'Falha no efeito.').slice(0,160));
          if(message.kind==='ready'){clearTimeout(draft.deadline);draft.ready=true;draft.reject=null;draft.idle=setTimeout(()=>fail('Prévia encerrada por inatividade.'),this.limits.idleMs);draft.expiry=setTimeout(()=>fail('A prévia expirou. Clique em Testar prévia novamente.'),this.limits.lifetimeMs);resolve();}
          if(message.kind==='frame'){
            clearTimeout(draft.deadline);draft.busy=false;
            if(message.preview===null)return;
            if(!Buffer.isBuffer(message.preview)||message.preview.length>512*1024)return this.stop('Quadro de prévia inválido.');
            const client=draft.client;if(!client)return;
            if(client.res.destroyed||client.res.writableLength>512*1024||!client.authorized())return this.stop('Prévia encerrada.');
            client.res.write('data: '+JSON.stringify({image:message.preview.toString('base64')})+'\n\n');
          }
        });
        child.send({kind:'load',effect,values:selected},error=>{if(error&&this.current===draft)this.stop('O processo da prévia falhou.');});
      });
      return {token:draft.token,effect:{id:effect.id,format:effect.format,name:effect.name,publisher:effect.publisher,controls:effect.controls},values:selected};
    }catch(error){if(this.current===draft)this.stop();throw error;}
  }
  find(token){if(!this.current||this.current.token!==token||!this.current.ready)throw Object.assign(Error('Prévia indisponível. Clique em Testar prévia novamente.'),{status:404});return this.current;}
  watch(token,res,authorized){
    const draft=this.find(token);if(draft.client)throw Object.assign(Error('A prévia já está aberta.'),{status:409});
    clearTimeout(draft.idle);draft.client={res,authorized};res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-store',Connection:'keep-alive'});res.write(': draft\n\n');
    const next=()=>{
      if(this.current!==draft)return;
      if(res.destroyed||res.writableLength>512*1024||!authorized())return this.stop('Prévia encerrada.');
      const now=performance.now();if(now<(draft.nextAt||0))return;draft.nextAt=Math.max((draft.nextAt||now)+1000/this.studio.fps,now);if(draft.busy)return;draft.busy=true;draft.deadline=setTimeout(()=>{if(this.current===draft)this.stop('O quadro da prévia excedeu o tempo limite.');},this.limits.frameMs);
      const preview=now-(draft.lastPreview||0)>=100;if(preview)draft.lastPreview=now;
      draft.child.send({kind:'frame',points:[],preview},error=>{if(error&&this.current===draft)this.stop('O processo da prévia falhou.');});
    };
    res.on('close',()=>{if(this.current===draft)this.stop();});res.on('error',()=>{if(this.current===draft)this.stop();});draft.timer=setInterval(next,8);next();
  }
  stop(message){
    const draft=this.current;if(!draft)return;this.current=null;
    for(const key of ['deadline','idle','expiry','timer'])clearTimeout(draft[key]);
    draft.reject?.(Error(message||'Prévia cancelada.'));draft.child.kill();
    if(draft.client){if(message&&!draft.client.res.destroyed)draft.client.res.write('event: draft-error\ndata: '+JSON.stringify({error:message})+'\n\n');draft.client.res.end();}
  }
  remove(token){this.find(token);this.stop();}
  close(){this.closed=true;this.stop();}
}
module.exports={DraftPreview};
