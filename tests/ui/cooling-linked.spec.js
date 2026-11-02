const {test,expect}=require('./fixture');
const fs=require('node:fs'),path=require('node:path');
const evidenceDirectory=path.resolve(__dirname,'../../data/cooling-dev/linked-ui-evidence');
async function capture(locator,name){
  if(process.env.NEXUS_COOLING_SCREENSHOTS!=='1')return;
  fs.mkdirSync(evidenceDirectory,{recursive:true});
  await locator.screenshot({path:path.join(evidenceDirectory,name)});
}
test.use({serviceWorkers:'block',coolingOptions:{autoPoll:false,bridgeFactory:()=>({async request(body){
  if(body.action==='open'||body.action==='sample')return {at:Date.now(),simulated:true,sensors:[{id:'cpu',name:'CPU package',value:42},{id:'gpu',name:'GPU core',value:76}],controls:[{id:'case-a',name:'Gabinete A',min:0,max:100},{id:'case-b',name:'Gabinete B',min:0,max:100}],fans:[]};
  return {};
},async close(){}})}});

test('shared cooling curve uses CPU/GPU maximum and survives reload without changing independent curves',async({page})=>{
  await page.goto('/');await page.locator('.nav[data-page=cooling]').click();await page.locator('#cooling-monitor').click();
  await page.getByLabel('Uma curva para os canais selecionados',{exact:true}).check();
  const group=page.locator('#cooling-group');await group.getByLabel('Sensor de temperatura do grupo',{exact:true}).selectOption('cpu');
  await group.getByRole('button',{name:'Adicionar sensor',exact:true}).click();
  await group.getByLabel('Sensor adicional de temperatura',{exact:true}).selectOption('gpu');
  await page.getByRole('button',{name:'Selecionar canais visíveis',exact:true}).click();
  await page.locator('#cooling-enabled').check();await expect(page.locator('#cooling-mode')).toContainText('Controle ativo');
  for(const row of await page.locator('.cooling-channel').all())await expect(row.locator('.cooling-output')).toContainText('76 °C');
  await expect(page.locator('.cooling-independent:visible')).toHaveCount(0);
  await page.reload();await page.locator('.nav[data-page=cooling]').click();await expect(page.getByLabel('Uma curva para os canais selecionados',{exact:true})).toBeChecked();
  await expect(group.getByLabel('Sensor adicional de temperatura',{exact:true})).toHaveValue('gpu');
  await expect(group.locator('.cooling-source-reading')).toHaveText(['42 °C','76 °C']);
  await page.locator('.nav[data-page=settings]').click();await page.locator('#settings-language').selectOption('en');await page.locator('.nav[data-page=cooling]').click();
  await expect(page.getByLabel('One curve for selected channels',{exact:true})).toBeChecked();
  for(const width of [1280,390]){
    await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await capture(page.locator('#cooling-group'),'linked-group-'+width+'.png');
  }
});

test('compact preset preview can inspect every factory curve without starting sensors or applying settings',async({page})=>{
  await page.goto('/');await page.locator('.nav[data-page=cooling]').click();
  const preview=page.locator('#cooling-profile-preview');await expect(preview).not.toHaveAttribute('open');
  await preview.locator('summary').click();const selection=preview.getByLabel('Perfil para visualizar',{exact:true});
  let mutations=0;page.on('request',request=>{if(request.method()==='POST'&&request.url().includes('/api/cooling'))mutations++;});
  for(const preset of ['silent','balanced','performance','aggressive','turbo']){
    await selection.selectOption(preset);await expect(preview.locator('polyline')).toHaveAttribute('points',/\d/);
    await expect(page.locator('#cooling-mode')).toHaveText('Desligado');
  }
  expect(mutations).toBe(0);await expect(page.locator('.cooling-channel')).toHaveCount(0);
  await page.locator('.nav[data-page=settings]').click();await page.locator('#settings-language').selectOption('en');await page.locator('.nav[data-page=cooling]').click();
  await expect(preview.getByLabel('Profile to preview',{exact:true})).toBeVisible();
  for(const width of [1280,390]){
    await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await capture(preview,'preset-preview-'+width+'.png');
  }
});
