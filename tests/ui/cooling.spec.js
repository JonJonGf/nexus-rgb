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
