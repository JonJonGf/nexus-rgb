(function(root) {
  'use strict';
  const endpoint='https://api.github.com/repos/JonJonGf/nexus-rgb/releases?per_page=10';
  function version(tag) {
    const m=/^v(0|[1-9]\d{0,8})\.(0|[1-9]\d{0,8})\.(0|[1-9]\d{0,8})(?:-(alpha|beta|rc)\.(0|[1-9]\d{0,8}))?$/.exec(tag||'');
    return m?{tag,base:m.slice(1,4).map(Number),channel:m[4]||'stable',iteration:Number(m[5]||0)}:null;
  }
  function compare(a,b) {
    for(let i=0;i<3;i++)if(a.base[i]!==b.base[i])return Math.sign(a.base[i]-b.base[i]);
    const order={alpha:0,beta:1,rc:2,stable:3};return Math.sign(order[a.channel]-order[b.channel])||Math.sign(a.iteration-b.iteration);
  }
  function select(releases,currentTag) {
    if(!Array.isArray(releases)||releases.length>10)throw Error('Resposta de atualização inválida.');
    const current=version(currentTag),valid=[];
    for(const release of releases) {
      const v=version(release?.tag_name);if(!v||release.draft!==false||!Array.isArray(release.assets)||current?.channel==='stable'&&v.channel!=='stable')continue;
      const core=v.base.join('.'),names=['NexusRGB-Setup-'+core+'.exe','SHA256SUMS.txt','BUILD-INFO.json'];
      if(!names.every(name=>release.assets.some(a=>a?.name===name&&a.state==='uploaded'&&Number.isSafeInteger(a.size)&&a.size>0)))continue;
      valid.push(v);
    }
    valid.sort((a,b)=>compare(b,a));const latest=valid[0];if(!latest)throw Error('Nenhuma versão compatível com instalador foi encontrada.');
    return {tag:latest.tag,url:'https://github.com/JonJonGf/nexus-rgb/releases/tag/'+latest.tag,newer:current?compare(latest,current)>0:null};
  }
  async function check(fetcher=fetch,currentTag) {
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8000);
    try {
      const response=await fetcher(endpoint,{headers:{Accept:'application/vnd.github+json'},credentials:'omit',referrerPolicy:'no-referrer',redirect:'error',cache:'no-store',signal:controller.signal});
      if(response.status===403||response.status===429)throw Error('O GitHub limitou as consultas. Tente novamente mais tarde.');
      if(!response.ok)throw Error('Não foi possível consultar o GitHub.');
      if(!/^application\/json(?:;|$)/i.test(response.headers.get('content-type')||''))throw Error('Resposta de atualização inválida.');
      const reader=response.body.getReader(),chunks=[];let size=0;
      try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>256*1024){await reader.cancel();throw Error('Resposta de atualização muito grande.');}chunks.push(value);}}finally{reader.releaseLock();}
      const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}
      return select(JSON.parse(new TextDecoder().decode(bytes)),currentTag);
    }finally{clearTimeout(timer);}
  }
  const api={version,compare,select,check,endpoint};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.NexusReleases=api;
})(typeof globalThis!=='undefined'?globalThis:this);
