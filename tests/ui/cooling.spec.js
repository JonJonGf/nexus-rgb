const {test,expect}=require('./fixture');
test.use({serviceWorkers:'block',coolingOptions:{autoPoll:false,bridgeFactory:()=>({async request(body){
  if(body.action==='open')await new Promise(resolve=>setTimeout(resolve,300));
  if(body.action==='open'||body.action==='sample')return {at:Date.now(),simulated:true,sensors:[{id:'cpu',name:'CPU',value:60}],controls:[{id:'fan-a',name:'Ventoinha CPU',min:0,max:100}],fans:[{id:'rpm-a',name:'CPU RPM',value:1200}]};
  return {released:true};
},async close(){}})}});

test('ventilação opcional tem cinco perfis, curva editável, TURBO e desativação sem alterar RGB',async({page})=>{
  await page.goto('/');await expect(page.locator('#power')).toBeEnabled();
  await expect(page.locator('.nav[data-page=cooling]')).toBeVisible();
  await page.locator('.nav[data-page=cooling]').click();
  await expect(page.locator('#cooling-enabled')).not.toBeChecked();
  await expect(page.locator('#cooling-profiles button')).toHaveCount(5);
  await page.locator('#cooling-monitor').click();
  await expect(page.locator('#cooling-mode')).toContainText('Simulação');
  await expect(page.locator('.cooling-channel')).toHaveCount(1);
  await page.getByLabel('Controlar este canal').check();
  await page.getByLabel('Sensor de temperatura',{exact:true}).selectOption('cpu');
  await page.locator('#cooling-profiles button[data-profile=silent]').click();
  await expect(page.getByLabel('Controlar este canal')).toBeChecked();
  await expect(page.getByLabel('Sensor de temperatura',{exact:true})).toHaveValue('cpu');
  await page.locator('#cooling-enabled').check();
  await expect(page.locator('#cooling-mode')).toContainText('Controle ativo');
  await page.locator('#cooling-profiles button[data-profile=turbo]').click();
  await expect(page.locator('.cooling-output')).toContainText('100%');
  await page.locator('#cooling-enabled').uncheck();
  await expect(page.locator('#cooling-mode')).toContainText('Desligado');
  await page.locator('.nav[data-page=settings]').click();
  await page.locator('#settings-language').selectOption('en');
  await page.locator('.nav[data-page=cooling]').click();
  await expect(page.locator('#page-title')).toHaveText('Cooling');
  await expect(page.locator('#cooling-profiles')).toContainText('Silent');
  await page.setViewportSize({width:390,height:844});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('sair durante a detecção encerra o monitoramento quando a resposta chega',async({page})=>{
  await page.goto('/');await expect(page.locator('#power')).toBeEnabled();
  await page.locator('.nav[data-page=cooling]').click();await page.locator('#cooling-monitor').click();
  await page.locator('.nav[data-page=settings]').click();
  await page.waitForTimeout(600);
  await page.locator('.nav[data-page=cooling]').click();
  await expect(page.locator('#cooling-mode')).toHaveText('Desligado');
  await expect(page.locator('.cooling-channel')).toHaveCount(0);
});

test('curve axis labels remain readable without icon outlines on desktop and mobile',async({page})=>{
 await page.goto('/');await page.locator('.nav[data-page=cooling]').click();
 await page.getByRole('button',{name:'Criar perfil personalizado',exact:true}).click();
 const graph=page.locator('#cooling-preset-editor .cooling-graph');
 for(const width of [1280,390]){
  await page.setViewportSize({width,height:900});await graph.scrollIntoViewIfNeeded();
  await expect(graph.locator('text')).toHaveText(['100%','0%','20 °C','100 °C']);
  if(process.env.NEXUS_UI_EVIDENCE_DIR){const fs=require('node:fs'),path=require('node:path');fs.mkdirSync(process.env.NEXUS_UI_EVIDENCE_DIR,{recursive:true});await graph.screenshot({path:path.join(process.env.NEXUS_UI_EVIDENCE_DIR,'curve-axis-'+width+'.png')});}
  const labels=await graph.locator('text').evaluateAll(nodes=>nodes.map(node=>{const {x,y,width,height}=node.getBBox(),style=getComputedStyle(node),view=node.ownerSVGElement.viewBox.baseVal;return {stroke:style.stroke,screenFont:parseFloat(style.fontSize)*node.getScreenCTM().a,box:{x,y,width,height},view:{x:view.x,y:view.y,width:view.width,height:view.height}};}));
  for(const label of labels){expect(label.stroke).toBe('none');expect(label.screenFont).toBeGreaterThanOrEqual(10);expect(label.box.x).toBeGreaterThanOrEqual(label.view.x);expect(label.box.x+label.box.width).toBeLessThanOrEqual(label.view.x+label.view.width);expect(label.box.y).toBeGreaterThanOrEqual(label.view.y);expect(label.box.y+label.box.height).toBeLessThanOrEqual(label.view.y+label.view.height);}
 }
});

test('manual curve mode is visible, editable and retained through polling without activating control',async({page})=>{
 await page.goto('/');await page.locator('.nav[data-page=cooling]').click();await page.locator('#cooling-monitor').click();
 const row=page.locator('.cooling-channel').first();await row.getByLabel('Modo de controle',{exact:true}).selectOption('manual');
 await expect(row.locator('.cooling-curve-editor')).toBeVisible();
 await row.getByLabel('Controlar este canal').check();await row.getByLabel('Sensor de temperatura',{exact:true}).selectOption('cpu');
  await row.getByLabel('Velocidade do ponto').nth(2).fill('72');await row.getByLabel('Traçado da curva',{exact:true}).selectOption('smooth');
  await row.locator('svg').scrollIntoViewIfNeeded();const handle=await row.locator('svg circle').nth(2).boundingBox();await page.mouse.move(handle.x+handle.width/2,handle.y+handle.height/2);await page.mouse.down();await page.mouse.move(handle.x+handle.width/2+8,handle.y+handle.height/2-8,{steps:4});await page.mouse.up();
  const dragged=await row.getByLabel('Velocidade do ponto').nth(2).inputValue();expect(Number(dragged)).toBeGreaterThan(72);await page.locator('#cooling-save').click();
 await expect(page.locator('#cooling-enabled')).not.toBeChecked();
  await expect(page.getByLabel('Modo de controle',{exact:true})).toHaveValue('manual');await expect(page.getByLabel('Velocidade do ponto').nth(2)).toHaveValue(dragged);await expect(page.getByLabel('Traçado da curva',{exact:true})).toHaveValue('smooth');
  if(process.env.NEXUS_UI_EVIDENCE_DIR){const fs=require('node:fs'),path=require('node:path');fs.mkdirSync(process.env.NEXUS_UI_EVIDENCE_DIR,{recursive:true});await row.locator('svg').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(process.env.NEXUS_UI_EVIDENCE_DIR,'manual-desktop.png'),fullPage:true});}
 await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  if(process.env.NEXUS_UI_EVIDENCE_DIR){await row.locator('svg').scrollIntoViewIfNeeded();await page.screenshot({path:require('node:path').join(process.env.NEXUS_UI_EVIDENCE_DIR,'manual-mobile.png'),fullPage:true});}
});

test('up to three named custom profiles can be saved, edited and removed without starting sensors',async({page})=>{
 await page.goto('/');await page.locator('.nav[data-page=cooling]').click();
 for(let i=1;i<=3;i++){
  await page.getByRole('button',{name:'Criar perfil personalizado',exact:true}).click();await page.getByLabel('Nome do perfil de ventilação').fill('Curva '+i);
  await page.locator('#cooling-preset-editor').getByLabel('Traçado da curva',{exact:true}).selectOption('smooth');
  await page.locator('#cooling-preset-editor').getByLabel('Velocidade do ponto').nth(2).fill('70');await page.getByRole('button',{name:'Salvar perfil personalizado',exact:true}).click();
  await expect(page.locator('#cooling-custom-list article')).toHaveCount(i);
 }
 await expect(page.getByRole('button',{name:'Criar perfil personalizado',exact:true})).toBeDisabled();
 await expect(page.locator('#cooling-mode')).toHaveText('Desligado');await expect(page.locator('.cooling-channel')).toHaveCount(0);
 const first=page.locator('#cooling-custom-list article').first();await first.getByRole('button',{name:'Editar',exact:true}).click();await expect(page.locator('#cooling-preset-editor').getByLabel('Traçado da curva',{exact:true})).toHaveValue('smooth');await page.getByLabel('Nome do perfil de ventilação').fill('Meu silêncio');await page.getByRole('button',{name:'Salvar perfil personalizado',exact:true}).click();await expect(first).toContainText('Meu silêncio');
 await first.getByRole('button',{name:'Excluir',exact:true}).click();await expect(page.locator('#cooling-custom-list article')).toHaveCount(2);await expect(page.getByRole('button',{name:'Criar perfil personalizado',exact:true})).toBeEnabled();
 await page.locator('.nav[data-page=settings]').click();await page.locator('#settings-language').selectOption('en');await page.locator('.nav[data-page=cooling]').click();
 await expect(page.getByRole('button',{name:'Create custom profile',exact:true})).toBeVisible();await page.locator('#cooling-custom-list article').first().getByRole('button',{name:'Edit',exact:true}).click();await expect(page.getByLabel('Curve shape',{exact:true})).toHaveValue('smooth');await expect(page.getByLabel('Cooling profile name')).toHaveValue('Curva 2');
 await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test.describe('useful channels',()=>{
 test.use({coolingOptions:{autoPoll:false,bridgeFactory:()=>({async request(){const prefix='/lpc/nct6798d/0';return {at:Date.now(),simulated:true,board:{manufacturer:'ASUSTeK COMPUTER INC.',model:'TUF GAMING A520M-PLUS II'},sensors:[{id:'cpu',name:'CPU',value:50}],controls:[...Array.from({length:7},(_,i)=>({id:prefix+'/control/'+i+'/control',name:'Nuvoton NCT6798D · Fan #'+(i+1),min:0,max:100})),{id:'/gpu-amd/0/control/0/control',name:'Radeon · GPU Fan',min:0,max:100}],fans:Array.from({length:7},(_,i)=>({id:prefix+'/fan/'+i,name:'Nuvoton NCT6798D · Fan #'+(i+1),value:i<3?900:0}))};},async close(){}})}});
 test('all detected channels stay available until explicitly hidden and identification preserves manual edits',async({page})=>{
  await page.goto('/');await page.locator('.nav[data-page=cooling]').click();await page.locator('#cooling-monitor').click();
  await expect(page.locator('.cooling-channel:visible')).toHaveCount(8);await expect(page.locator('.cooling-channel h3').first()).toHaveText('Nuvoton NCT6798D · Fan #1');
  const row=page.locator('.cooling-channel').first();await row.getByLabel('Modo de controle',{exact:true}).selectOption('manual');await row.getByLabel('Velocidade do ponto').nth(2).fill('70');
  await row.locator('summary').filter({hasText:'Identificar canal'}).click();await row.getByLabel('Nome deste canal',{exact:true}).fill('Fans do gabinete');await row.getByRole('button',{name:'Salvar identificação',exact:true}).click();await expect(row.locator('h3')).toHaveText('Fans do gabinete');await expect(row.getByLabel('Velocidade do ponto').nth(2)).toHaveValue('70');
  const other=page.locator('.cooling-channel').nth(1);await other.locator('summary').filter({hasText:'Identificar canal'}).click();await other.getByLabel('Nome deste canal',{exact:true}).fill('<img src=x>');await other.getByRole('button',{name:'Salvar identificação',exact:true}).click();await expect(other.locator('h3')).toHaveText('<img src=x>');await expect(other.locator('img')).toHaveCount(0);
  const unused=page.locator('.cooling-channel').nth(6);await unused.locator('summary').filter({hasText:'Identificar canal'}).click();await unused.getByLabel('Ocultar este canal').check();await unused.getByRole('button',{name:'Salvar identificação',exact:true}).click();await expect(page.locator('.cooling-channel:visible')).toHaveCount(7);
  await page.getByLabel('Mostrar todos os canais').check();await expect(page.locator('.cooling-channel:visible')).toHaveCount(8);
  await page.getByLabel('Mostrar todos os canais').uncheck();await expect(page.locator('.cooling-channel:visible')).toHaveCount(7);await expect(row.getByLabel('Velocidade do ponto').nth(2)).toHaveValue('70');await expect(page.locator('#cooling-enabled')).not.toBeChecked();
  if(process.env.NEXUS_UI_EVIDENCE_DIR){const fs=require('node:fs'),path=require('node:path');fs.mkdirSync(process.env.NEXUS_UI_EVIDENCE_DIR,{recursive:true});await row.locator('h3').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(process.env.NEXUS_UI_EVIDENCE_DIR,'identified-channel-desktop.png')});await row.getByRole('button',{name:'Salvar identificação',exact:true}).scrollIntoViewIfNeeded();await page.screenshot({path:path.join(process.env.NEXUS_UI_EVIDENCE_DIR,'identification-editor-desktop.png')});await page.setViewportSize({width:390,height:844});await row.locator('h3').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(process.env.NEXUS_UI_EVIDENCE_DIR,'identified-channel-mobile.png')});await row.getByRole('button',{name:'Salvar identificação',exact:true}).scrollIntoViewIfNeeded();await page.screenshot({path:path.join(process.env.NEXUS_UI_EVIDENCE_DIR,'identification-editor-mobile.png')});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
  await page.reload();await page.locator('.nav[data-page=cooling]').click();await page.locator('#cooling-monitor').click();await expect(page.locator('.cooling-channel h3').first()).toHaveText('Fans do gabinete');await expect(page.locator('.cooling-channel:visible')).toHaveCount(7);
 });
});

test.describe('limited hardware',()=>{
 test.use({coolingOptions:{autoPoll:false,bridgeFactory:()=>({async request(){return {at:Date.now(),simulated:true,sensors:[{id:'cpu',name:'CPU',value:45}],controls:[{id:'limited',name:'Control reported by firmware',min:0,max:10}],fans:[]};},async close(){}})}});
 test('unsupported control ranges stay visible as read-only rather than offering an unusable curve',async({page})=>{
  await page.goto('/');await page.locator('.nav[data-page=cooling]').click();await page.locator('#cooling-monitor').click();
  await expect(page.getByLabel('Controlar este canal')).toBeDisabled();await expect(page.locator('.cooling-channel')).toContainText('Somente leitura: sem faixa segura de controle');await expect(page.locator('#cooling-enabled')).toBeDisabled();
  await expect(page.locator('#cooling-capabilities')).toContainText('0 com faixa segura');
 });
});
