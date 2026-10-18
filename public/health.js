'use strict';
window.NexusHealth={create(hooks){
  const T=window.NexusI18n,$=id=>document.getElementById(id);let timer,busy=false,admin=false,report;
  const roles=T.map({'network-service':'Serviço de rede','hardware-service':'Serviço de hardware',server:'Servidor',openrgb:'OpenRGB','effect-worker':'Motor de efeitos','hid-bridge':'Ponte USB',tray:'Ícone da bandeja'});
  const allowedKeys=['build','runtime','health','components','render','alexa','resources','errors'];
  function filteredReport() {
    if (!report) return null;
    const active = new Set(Array.from(document.querySelectorAll('#diagnostic-categories input[type=checkbox]:checked')).map(c => c.dataset.diagCategory).filter(k => allowedKeys.includes(k)));
    const out = { format: 'nexus-diagnostics/1', createdAt: report.createdAt };
    for (const key of allowedKeys) {
      if (active.has(key) && Object.hasOwn(report, key)) out[key] = report[key];
    }
    return out;
  }
  function renderReport() {
    const out = filteredReport();
    if (!out) return;
    $('diagnostic-content').textContent = JSON.stringify(out, null, 2);
  }
  function renderConflicts(conf) {
    const box = $('health-conflicts');
    if (!box) return;
    if (!conf || !conf.hasConflicts) {
      box.hidden = true;
      box.replaceChildren();
      return;
    }
    box.hidden = false;
    box.replaceChildren();
    if (conf.dynamicLighting && conf.dynamicLighting.enabled) {
      const p = document.createElement('p');
      p.className = 'conflict-item';
      p.textContent = T('Atenção: A Iluminação Dinâmica do Windows está ativada. Isso pode disputar o controle dos dispositivos USB/HID com o Nexus RGB. Se houver perda de controle ou cintilação, desative-a nas Configurações do Windows > Personalização > Iluminação Dinâmica.');
      box.append(p);
    }
    if (conf.conflicts && conf.conflicts.length > 0) {
      const p = document.createElement('p');
      p.className = 'conflict-item';
      const names = conf.conflicts.map(c => c.name).join(', ');
      p.textContent = T('Softwares concorrentes em execução: {0}. Eles podem disputar o barramento SMBus ou portas USB e causar travamentos no controlador.', names);
      box.append(p);
    }
  }
  let lastConflicts = null;
  async function sample(){if(busy||!admin||document.hidden)return;busy=true;try{const [data,conflicts]=await Promise.all([hooks.api('/api/resources'),hooks.api('/api/conflicts').catch(()=>null)]);lastConflicts=conflicts;$('health-total').textContent=(data.cpuPercent===null?T('CPU: aguardando outra amostra'):data.cpuPercent+'% CPU')+' · '+data.memoryMB+' MiB';$('health-scope').textContent=T(data.partial?'Leitura parcial: alguns processos não puderam ser consultados.':'Processos pertencentes a esta instalação.')+' '+T('A memória soma conjuntos de trabalho e pode contar páginas compartilhadas mais de uma vez. CPU usa o total de processadores lógicos.');const rows=$('health-processes');rows.replaceChildren();for(const r of data.processes){const row=document.createElement('tr');for(const text of [roles[r.role],String(r.pid),r.cpuPercent===null?'—':r.cpuPercent+'%',r.memoryMB+' MiB']){const td=document.createElement('td');td.textContent=text;row.append(td);}rows.append(row);}renderConflicts(conflicts);}catch(e){$('health-scope').textContent=T(e.message);}finally{busy=false;}}
  $('health-refresh').addEventListener('click',sample);
  $('diagnostic-review').addEventListener('click',async()=>{try{report=await hooks.api('/api/diagnostics');renderReport();$('diagnostic-details').hidden=false;}catch(e){$('health-scope').textContent=T(e.message);}});
  $('diagnostic-categories')?.addEventListener('change',renderReport);
  $('diagnostic-export').addEventListener('click',()=>{if(!report)return;const text=$('diagnostic-content').textContent+'\n';const url=URL.createObjectURL(new Blob([text],{type:'application/json;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='NexusRGB-diagnostic.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&timer)sample();});
  window.addEventListener('nexus:languagechange',()=>{if(lastConflicts)renderConflicts(lastConflicts);});
  return {open(page){clearInterval(timer);timer=null;if(page==='settings'&&admin){sample();timer=setInterval(sample,10000);}},update(value,state){admin=value;$('health-local').hidden=!value;const hw=state.hardware;$('health-state').textContent=T(hw.controllerHung?'OpenRGB não respondeu ao consultar um componente':!hw.connected?'Reconectando ao controlador':hw.detecting||!hw.devices.length?'Detectando componentes':hw.nativeError||hw.devices.some(d=>d.error||d.status==='offline'||d.status==='error')?'Alguns componentes precisam de atenção':'Pronto para controlar');}};
}};
