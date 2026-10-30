'use strict';
const path=require('node:path'),crypto=require('node:crypto');
const {readJson,writeJson}=require('./store');
const modes=['open','authorized','local'];
const digest=token=>crypto.createHash('sha256').update(token).digest('hex');

class AccessPolicy {
  constructor(directory){
    this.file=directory?path.join(directory,'access.json'):null;
    this.config={mode:'open',linkHash:null};this.error=null;
    try{
      const saved=this.file?readJson(this.file,this.config):this.config;
      if(!saved||!modes.includes(saved.mode)||saved.linkHash!==null&&!/^[a-f0-9]{64}$/.test(saved.linkHash)||Object.keys(saved).some(k=>!['mode','linkHash'].includes(k)))throw Error('Configuração de acesso inválida.');
      this.config=saved;
    }catch(error){this.config={mode:'local',linkHash:null};this.error=error.message;}
  }
  snapshot(){return {mode:this.config.mode,linkReady:Boolean(this.config.linkHash),error:this.error};}
  save(config){if(this.file)writeJson(this.file,config);this.config=config;this.error=null;}
  configure(body){
    if(!body||Array.isArray(body)||typeof body!=='object'||Object.keys(body).length!==1)throw Error('Configuração de acesso inválida.');
    if(body.revoke===true){this.save({...this.config,linkHash:null});}
    else {if(!modes.includes(body.mode))throw Error('Modo de acesso inválido.');this.save({mode:body.mode,linkHash:null});}
    return this.snapshot();
  }
  issue(){
    if(this.config.mode==='local')throw Object.assign(Error('O acesso está restrito a este PC.'),{status:409});
    if(this.config.mode!=='authorized')return null;
    const token=crypto.randomBytes(32).toString('base64url');
    this.save({...this.config,linkHash:digest(token)});return token;
  }
  accepts(token){
    if(typeof token!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(token)||!this.config.linkHash)return false;
    return crypto.timingSafeEqual(Buffer.from(digest(token),'hex'),Buffer.from(this.config.linkHash,'hex'));
  }
  allows(req){
    if(this.config.mode==='open')return true;
    if(this.config.mode==='local')return false;
    return this.accepts((req.headers.cookie||'').match(/(?:^|;\s*)nexus_access=([A-Za-z0-9_-]{43})(?:;|$)/)?.[1]);
  }
}
module.exports={AccessPolicy};
