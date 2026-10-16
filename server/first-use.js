'use strict';
const fs=require('node:fs'),path=require('node:path'),{readEffectJson,writeJson}=require('./store');
class FirstUse {
  constructor(directory,disabled=false){
    this.file=disabled?null:path.join(directory,'first-use.json');this.seen=true;if(!this.file)return;
    if(fs.existsSync(this.file)){const value=readEffectJson(this.file);if(typeof value.seen!=='boolean')throw Error('Registro de primeiro uso inválido.');this.seen=value.seen;}
    else{this.seen=fs.existsSync(path.join(directory,'settings.json'));writeJson(this.file,{seen:this.seen});}
  }
  take(){if(this.seen)return false;writeJson(this.file,{seen:true});this.seen=true;return true;}
}
module.exports={FirstUse};
