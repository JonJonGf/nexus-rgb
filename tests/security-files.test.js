'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {readEffectJson,writeJson,Store}=require('../server/store'),{collectLicenses}=require('../scripts/licenses');
function directory(t){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'nexus-file-security-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));return dir;}
test('leitura de efeito recusa hardlinks, tamanho excessivo e troca do nome durante a abertura',t=>{
 const dir=directory(t),file=path.join(dir,'effect.json'),alias=path.join(dir,'alias.json');fs.writeFileSync(file,'{"original":"safe"}');assert.equal(readEffectJson(file).original,'safe');
 fs.linkSync(file,alias);assert.throws(()=>readEffectJson(file),/inválido/);fs.unlinkSync(alias);
 fs.writeFileSync(file,' '.repeat(256*1024+1));assert.throws(()=>readEffectJson(file),/inválido/);fs.writeFileSync(file,'{"original":"safe"}');
 const open=fs.openSync;let replaced=false;
 fs.openSync=function(...args){const fd=open(...args);if(args[0]===file&&!replaced){replaced=true;fs.renameSync(file,alias);fs.writeFileSync(file,'{"original":"replacement"}');}return fd;};
 try{assert.throws(()=>readEffectJson(file),/inválido/);}finally{fs.openSync=open;}
});
test('troca após conferir o arquivo não redireciona a leitura do descritor já aberto',t=>{
 const dir=directory(t),file=path.join(dir,'effect.json');fs.writeFileSync(file,'{"original":"safe"}');const read=fs.readSync;let changed=false;
 fs.readSync=function(...args){if(!changed){changed=true;fs.renameSync(file,path.join(dir,'old.json'));fs.writeFileSync(file,'{"original":"replacement"}');}return read(...args);};
 try{assert.equal(readEffectJson(file).original,'safe');assert.equal(JSON.parse(fs.readFileSync(file)).original,'replacement');}finally{fs.readSync=read;}
});
test('gravação atômica não sobrescreve nem apaga um temporário preexistente',t=>{
 const dir=directory(t),file=path.join(dir,'settings.json'),fixed='112233445566',temporary=file+'.'+fixed+'.tmp';fs.writeFileSync(file,'old');fs.writeFileSync(temporary,'keep');const random=crypto.randomBytes;
 crypto.randomBytes=()=>Buffer.from(fixed,'hex');try{assert.throws(()=>writeJson(file,{safe:true}),{code:'EEXIST'});}finally{crypto.randomBytes=random;}
 assert.equal(fs.readFileSync(file,'utf8'),'old');assert.equal(fs.readFileSync(temporary,'utf8'),'keep');fs.unlinkSync(temporary);writeJson(file,{safe:true});assert.deepEqual(JSON.parse(fs.readFileSync(file)),{safe:true});
});
test('identificadores de zona recusam propriedades especiais antes de alterar o estado',t=>{
 const store=new Store(directory(t)),id='a'.repeat(24),before=structuredClone(store.data);
 for(const zone of ['__proto__','constructor','prototype',{},-1,65536,1.5])assert.throws(()=>store.zone(id,zone,12),/inválido/);
 assert.throws(()=>store.zone('__proto__',1,12),/inválido/);assert.deepEqual(store.data,before);assert.equal(Object.prototype.polluted,undefined);store.zone(id,1,12);assert.equal(store.data.zones[id][1],12);
});
test('redimensionamento recusa chaves especiais sem chamar o SDK',async t=>{
 const store=new Store(directory(t)),{Hardware}=require('../server/hardware'),hardware=new Hardware(store);let writes=0;
 hardware.connected=true;hardware.client={resizeZone(){writes++;}};
 for(const zone of ['__proto__','constructor',{},-1,1.5])await assert.rejects(hardware.resize('a'.repeat(24),zone,12),/inválido/);
 assert.equal(writes,0);assert.equal(Object.prototype.polluted,undefined);
});
test('metadados HTML são texto de apresentação e atributos não alteram protótipos',()=>{
 const schema=require('../server/studio-schema');const effect=schema.parseHTML('<title>Label &lt;script&gt;</title><meta __proto__="polluted" publisher="label&lt;script"><canvas id="exCanvas"></canvas><script>var x=1;</script>');
 assert.equal(effect.name,'Label &lt;script&gt;');assert.equal(effect.publisher,'label&lt;script');assert.equal(Object.prototype.polluted,undefined);
 assert.throws(()=>schema.parseHTML('<canvas id="exCanvas"></canvas><script src="https://example.invalid/x"></script>'));
 assert.throws(()=>schema.parseHTML('<canvas id="exCanvas"></canvas><script>var x=1;</script\t\n bar>'));
});
test('metadados de dependências não escapam da pasta de licenças nem sobrescrevem um hardlink externo',t=>{
 const dir=directory(t),root=path.join(dir,'app'),pkg=path.join(root,'node_modules','example');fs.mkdirSync(pkg,{recursive:true});fs.mkdirSync(path.join(root,'licenses'));fs.mkdirSync(path.join(root,'docs','licenses'),{recursive:true});fs.writeFileSync(path.join(root,'docs','licenses','canvas-1.0.11-NOTICES.txt'),'canvas');
 const meta=version=>fs.writeFileSync(path.join(pkg,'package.json'),JSON.stringify({name:'example',version,license:'MIT'}));fs.writeFileSync(path.join(pkg,'LICENSE'),'license');
 for(const version of ['../../outside','..\\..\\outside','bad:stream']){meta(version);assert.throws(()=>collectLicenses(root),/inválido/);assert.equal(fs.existsSync(path.join(dir,'outside-LICENSE')),false);}
 meta('1.0.0');const external=path.join(dir,'outside.txt');fs.writeFileSync(external,'keep');fs.linkSync(external,path.join(root,'licenses','example-1.0.0-LICENSE'));assert.equal(collectLicenses(root).length,1);assert.equal(fs.readFileSync(external,'utf8'),'keep');assert.equal(fs.readFileSync(path.join(root,'licenses','example-1.0.0-LICENSE'),'utf8'),'license');
});
