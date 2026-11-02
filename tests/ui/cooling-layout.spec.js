const {test,expect}=require('./fixture');
const fs=require('node:fs'),path=require('node:path');
const evidenceDirectory=path.resolve(__dirname,'../../data/cooling-dev/layout-evidence');
let gpuTemperature=76;
test.beforeEach(()=>{gpuTemperature=76;});
test.use({serviceWorkers:'block',coolingOptions:{bridgeFactory:()=>({async request(body){
  if(body.action==='open'||body.action==='sample')return {at:Date.now(),simulated:true,
    sensors:[{id:'cpu',name:'AMD Ryzen 5 3600 · Core (Tctl/Tdie)',value:48},{id:'gpu',name:'AMD Radeon Graphics · GPU Core Temperature',value:gpuTemperature}],
    controls:Array.from({length:3},(_,i)=>({id:'fan-'+i,name:'Nuvoton NCT6798D · Fan #'+(i+1),min:0,max:100})),
    fans:Array.from({length:3},(_,i)=>({id:'rpm-'+i,name:'Nuvoton NCT6798D · Fan #'+(i+1),value:1100+i*30}))};
  return {};
},async close(){}})}});

test('long sensor names keep source and RPM selectors full width with readable temperatures',async({page})=>{
  await page.setViewportSize({width:1600,height:1000});await page.goto('/');await page.locator('.nav[data-page=cooling]').click();await page.locator('#cooling-monitor').click();
  const rows=page.locator('.cooling-channel');await expect(rows).toHaveCount(3);
  for(let i=0;i<3;i++){
    const row=rows.nth(i);await row.getByLabel('Sensor de temperatura',{exact:true}).selectOption('cpu');
    await row.getByRole('button',{name:'Adicionar sensor',exact:true}).click();await row.getByLabel('Sensor adicional de temperatura',{exact:true}).selectOption('gpu');
    await row.getByLabel('Leitura de RPM',{exact:true}).selectOption('rpm-'+i);
  }
  for(const row of await rows.all()){
    const card=await row.boundingBox(),primary=await row.getByLabel('Sensor de temperatura',{exact:true}).boundingBox(),rpm=await row.getByLabel('Leitura de RPM',{exact:true}).boundingBox();
    expect(rpm.height).toBeLessThanOrEqual(52);expect(primary.width/card.width).toBeGreaterThan(.7);
    await expect(row.locator('.cooling-source-reading')).toHaveText(['48 °C','76 °C']);
  }
  for(const width of [1600,1280,390]){
    await page.setViewportSize({width,height:1000});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    if(process.env.NEXUS_COOLING_SCREENSHOTS==='1'){fs.mkdirSync(evidenceDirectory,{recursive:true});await (width===390?rows.first():page.locator('#cooling-channels')).screenshot({path:path.join(evidenceDirectory,'channels-'+width+'.png')});}
  }
});

test('selected temperatures refresh, change hottest source and report unavailable readings without applying fans',async({page})=>{
  await page.goto('/');await page.locator('.nav[data-page=cooling]').click();await page.locator('#cooling-monitor').click();
  const row=page.locator('.cooling-channel').first();await row.getByLabel('Controlar este canal').check();
  await row.getByLabel('Sensor de temperatura',{exact:true}).selectOption('cpu');await row.getByRole('button',{name:'Adicionar sensor',exact:true}).click();
  await row.getByLabel('Sensor adicional de temperatura',{exact:true}).selectOption('gpu');await page.locator('#cooling-save').click();
  let writes=0;page.on('request',request=>{if(request.method()==='POST'&&new URL(request.url()).pathname==='/api/cooling')writes++;});
  await expect(row.locator('.cooling-source-reading.is-hottest')).toHaveText('76 °C');
  gpuTemperature=43;await expect(row.locator('.cooling-source-reading')).toHaveText(['48 °C','43 °C']);await expect(row.locator('.cooling-source-reading.is-hottest')).toHaveText('48 °C');
  gpuTemperature=null;await expect(row.locator('.cooling-source-reading').nth(1)).toHaveText('Indisponível');await expect(row.locator('.cooling-source-reading.is-hottest')).toHaveCount(0);
  await page.locator('.nav[data-page=settings]').click();await page.locator('#settings-language').selectOption('en');await page.locator('.nav[data-page=cooling]').click();
  await page.locator('#cooling-monitor').click();
  await expect(row.locator('.cooling-source-reading').nth(1)).toHaveText('Unavailable');await expect(page.locator('#cooling-enabled')).not.toBeChecked();expect(writes).toBe(0);
});
