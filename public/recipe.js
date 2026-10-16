'use strict';
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.NexusRecipe=factory();})(typeof globalThis!=='undefined'?globalThis:this,()=>{
  const patterns=['wave','comet','rings','gradient'];
  function normalize(input){
    if(!input||typeof input!=='object'||Array.isArray(input)||input.format!=='nexus-effect/1'||typeof input.name!=='string'||!input.name.length||input.name.length>60||!patterns.includes(input.pattern))throw Error('Formato Nexus inválido. Use nexus-effect/1 e um padrão suportado.');
    if(!Array.isArray(input.palette)||!input.palette.length||input.palette.length>8||input.palette.some(c=>typeof c!=='string'||!/^#[\da-f]{6}$/i.test(c)))throw Error('Escolha de 1 a 8 cores #RRGGBB.');
    if(!Number.isFinite(input.speed)||input.speed<0||input.speed>100||!Number.isFinite(input.angle)||input.angle< -360||input.angle>360||!Number.isFinite(input.scale)||input.scale<0.1||input.scale>10)throw Error('Velocidade, direção ou escala inválidas.');
    return {format:input.format,name:input.name.replace(/<[^>]*>/g,'').replace(/[\x00-\x1f]/g,' ').trim().slice(0,60),pattern:input.pattern,palette:input.palette.map(c=>c.toLowerCase()),speed:input.speed,angle:input.angle,scale:input.scale};
  }
  function parse(source){
    if(typeof source!=='string'||new TextEncoder().encode(source).length>128*1024)throw Error('Efeito: limite de 128 KiB.');
    let text=source.trim();const fence=text.match(/^```(?:json)?\s*\n([\s\S]*?)\n```$/i);if(fence)text=fence[1].trim();text=text.replace(/^json\s*(?=\{)/i,'');
    let value;try{value=JSON.parse(text);}catch{throw Error('JSON incompleto ou inválido. Confira aspas, vírgulas e chaves.');}
    return normalize(value);
  }
  function color(palette,position){const step=((position%1+1)%1)*palette.length,index=Math.floor(step),a=palette[index],b=palette[(index+1)%palette.length];return [1,3,5].map(i=>Math.round(parseInt(a.slice(i,i+2),16)+(parseInt(b.slice(i,i+2),16)-parseInt(a.slice(i,i+2),16))*(step%1)));}
  function draw(ctx,e,seconds,w=320,h=200){
    ctx.resetTransform();ctx.globalAlpha=1;ctx.fillStyle='#000000';ctx.fillRect(0,0,w,h);
    const angle=e.angle*Math.PI/180,phase=seconds*e.speed/100*0.7,span=Math.hypot(w,h)*2;
    ctx.save();ctx.translate(w/2,h/2);ctx.rotate(angle);
    const gradient=e.pattern==='rings'?ctx.createRadialGradient(0,0,0,0,0,span/2):ctx.createLinearGradient(-span/2,0,span/2,0);
    for(let index=0;index<=128;index++){const position=index/128*e.scale*(e.pattern==='rings'?3:2),t=e.pattern==='gradient'?position:position-phase,c=color(e.palette,t),intensity=e.pattern==='comet'?Math.pow(Math.max(0,1-(((t%1)+1)%1)/0.25),2):1;gradient.addColorStop(index/128,'rgb('+c.map(v=>Math.round(v*intensity)).join(',')+')');}
    ctx.fillStyle=gradient;ctx.fillRect(-span/2,-span/2,span,span);ctx.restore();
  }
  return {normalize,parse,draw,patterns};
});
