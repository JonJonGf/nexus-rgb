'use strict';
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.NexusRecipe=factory();})(typeof globalThis!=='undefined'?globalThis:this,()=>{
  const patterns=['wave','comet','rings','gradient','scanner','rain','spiral','plasma','fire','sparkle','ripples','blocks'];
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
  function draw(ctx,e,seconds,w=320,h=200,createSurface){
    if(!['wave','comet','rings','gradient'].includes(e.pattern))return field(ctx,e,seconds,w,h,createSurface);
    ctx.resetTransform();ctx.globalAlpha=1;ctx.fillStyle='#000000';ctx.fillRect(0,0,w,h);
    const angle=e.angle*Math.PI/180,phase=seconds*e.speed/100*0.7,span=Math.hypot(w,h)*2;
    ctx.save();ctx.translate(w/2,h/2);ctx.rotate(angle);
    const gradient=e.pattern==='rings'?ctx.createRadialGradient(0,0,0,0,0,span/2):ctx.createLinearGradient(-span/2,0,span/2,0);
    for(let index=0;index<=128;index++){const position=index/128*e.scale*(e.pattern==='rings'?3:2),t=e.pattern==='gradient'?position:position-phase,c=color(e.palette,t),intensity=e.pattern==='comet'?Math.pow(Math.max(0,1-(((t%1)+1)%1)/0.25),2):1;gradient.addColorStop(index/128,'rgb('+c.map(v=>Math.round(v*intensity)).join(',')+')');}
    ctx.fillStyle=gradient;ctx.fillRect(-span/2,-span/2,span,span);ctx.restore();
  }
  const fract=n=>n-Math.floor(n),hash=n=>fract(Math.sin(n*127.1+311.7)*43758.5453);
  const surfaces=new WeakMap();
  function field(ctx,e,seconds,width,height,createSurface){
    let surface=surfaces.get(ctx);
    if(!surface){const canvas=createSurface?createSurface(80,50):typeof OffscreenCanvas==='function'?new OffscreenCanvas(80,50):document.createElement('canvas');canvas.width=80;canvas.height=50;const context=canvas.getContext('2d');surface={canvas,context,pixels:context.createImageData(80,50)};surfaces.set(ctx,surface);}
    const w=80,h=50,out=surface.pixels.data,step=1,time=seconds*e.speed/100,theta=e.angle*Math.PI/180,cs=Math.cos(theta),sn=Math.sin(theta),palette=e.palette.map(c=>[1,3,5].map(i=>parseInt(c.slice(i,i+2),16)));
    const mix=t=>{const p=fract(t)*palette.length,i=Math.floor(p),a=palette[i],b=palette[(i+1)%palette.length];return a.map((v,k)=>Math.round(v+(b[k]-v)*(p-i)))};
    for(let y=0;y<h;y+=step)for(let x=0;x<w;x+=step){
      const px=(x+step/2)/w-.5,py=(y+step/2)/h-.5,u=(px*cs+py*sn)*e.scale,v=(-px*sn+py*cs)*e.scale,r=Math.hypot(u,v),a=Math.atan2(v,u);let hue=0,light=1;
      switch(e.pattern){
        case 'scanner': {const p=Math.sin(time*2)*.45*e.scale,d=Math.abs(u-p);light=Math.exp(-d*d*170);hue=time*.15+v*.3;break;}
        case 'rain': {const lane=Math.floor(v*18),head=fract(u*.65-time*(.45+hash(lane)*.6)+hash(lane+80)),edge=Math.abs(fract(v*18)-.5);light=edge<.23&&head<.22?Math.pow(1-head/.22,2):0;hue=hash(lane+7)+time*.08;break;}
        case 'spiral': hue=a/(Math.PI*2)*3-r*2+time*.5;light=.55+.45*Math.sin(hue*Math.PI*2);break;
        case 'plasma': hue=(Math.sin(u*7+time*1.4)+Math.sin(v*9-time)+Math.sin((u+v)*5+time*.7))/6+.5;break;
        case 'fire': {const lift=.5-u,noise=(Math.sin(v*18+time*3)+Math.sin(v*31-time*4)+Math.sin(u*20-time*5))*.09;light=Math.max(0,Math.min(1,lift+noise));hue=Math.max(0,Math.min(.999,(1-light)*.65));light=Math.pow(light,1.6);break;}
        case 'sparkle': {const gx=Math.floor(u*24),gy=Math.floor(v*16),seed=hash(gx*37+gy*149);light=Math.pow(Math.max(0,Math.sin(time*(1+seed*2)+seed*40)),12);hue=seed;break;}
        case 'ripples': {const r1=Math.hypot(u+.23,v+.17),r2=Math.hypot(u-.28,v-.2);hue=(Math.sin(r1*22-time*3)+Math.sin(r2*25-time*2.3))/4+.5;light=.35+.65*Math.abs(Math.sin((r1-r2)*15+time));break;}
        case 'blocks': {const gx=Math.floor(u*8-time*.8),gy=Math.floor(v*6);hue=hash(gx+gy*71);light=.65+.35*Math.sin(time+gx+gy);break;}
      }
      const rgb=mix(hue).map(c=>Math.round(c*Math.max(0,Math.min(1,light))));
      for(let dy=0;dy<step&&y+dy<h;dy++)for(let dx=0;dx<step&&x+dx<w;dx++){const i=((y+dy)*w+x+dx)*4;out[i]=rgb[0];out[i+1]=rgb[1];out[i+2]=rgb[2];out[i+3]=255;}
    }
    surface.context.putImageData(surface.pixels,0,0);ctx.resetTransform();ctx.globalAlpha=1;ctx.imageSmoothingEnabled=true;ctx.drawImage(surface.canvas,0,0,width,height);
  }
  return {normalize,parse,draw,patterns};
});
