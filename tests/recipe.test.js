'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto'),{createCanvas}=require('@napi-rs/canvas');
const recipe=require('../public/recipe'),schema=require('../server/studio-schema'),{StudioRenderer}=require('../server/studio-render');
const cascade={format:'nexus-effect/1',name:'Rainbow Cascade',pattern:'gradient',palette:['#ff0000','#ff7f00','#ffff00','#00ff00','#00f0ff','#0000ff','#7f00ff'],speed:40,angle:90,scale:1.2};
test('rascunho aceita o exemplo, rótulos de cópia e cercas JSON, sem executar código',()=>{
 for(const source of [JSON.stringify(cascade),'JSON\n'+JSON.stringify(cascade),'```json\n'+JSON.stringify(cascade)+'\n```'])assert.deepEqual(recipe.parse(source),cascade);
 for(const bad of ['{','{"format":1}','(()=>{globalThis.polluted=true})()',JSON.stringify({...cascade,pattern:'invented'}),JSON.stringify({...cascade,palette:Array(9).fill('#ff0000')}),JSON.stringify({...cascade,angle:361})])assert.throws(()=>recipe.parse(bad));
 assert.equal(globalThis.polluted,undefined);assert.throws(()=>recipe.parse(' '.repeat(131073)));
});
test('IDs existentes continuam estáveis e usam a mesma validação do editor',()=>{
 assert.equal(schema.recipe(cascade).id,crypto.createHash('sha256').update(JSON.stringify(cascade)).digest('hex').slice(0,24));
 for(const pattern of recipe.patterns){const input={...cascade,pattern};assert.deepEqual(recipe.normalize(input),Object.fromEntries(Object.entries(schema.recipe(input)).filter(([key])=>['format','name','pattern','palette','speed','angle','scale'].includes(key))));}
});
test('gradiente é estático; wave, comet e rings animam e ritmo zero pausa',async()=>{
 for(const pattern of recipe.patterns){const renderer=new StudioRenderer();try{await renderer.load(schema.recipe({...cascade,pattern}));const a=Buffer.from(renderer.frame(0)),b=Buffer.from(renderer.frame(1500));if(pattern==='gradient')assert.deepEqual(a,b);else assert.notDeepEqual(a,b);await renderer.load(schema.recipe({...cascade,pattern,speed:0}));assert.deepEqual(Buffer.from(renderer.frame(0)),Buffer.from(renderer.frame(1500)));}finally{renderer.close();}}
});
test('desenho do editor corresponde ao motor, inclusive direção e mudança de paleta',async()=>{
 const renderer=new StudioRenderer(),canvas=createCanvas(320,200),ctx=canvas.getContext('2d');try{
  for(const pattern of recipe.patterns){const input={...cascade,pattern};await renderer.load(schema.recipe(input));recipe.draw(ctx,input,1.5);assert.deepEqual(Buffer.from(ctx.getImageData(0,0,320,200).data),Buffer.from(renderer.frame(1500)));}
  recipe.draw(ctx,cascade,0);const image=Buffer.from(ctx.getImageData(0,0,320,200).data);recipe.draw(ctx,{...cascade,palette:['#000000','#ffffff'],angle:0},0);assert.notDeepEqual(image,Buffer.from(ctx.getImageData(0,0,320,200).data));
 }finally{renderer.close();}
});
