const {test,expect}=require('./fixture');
test.use({serviceWorkers:'block'});
test('central mostra escopo parcial e diagnóstico revisável sem transmissão externa',async({page})=>{
  await page.goto('/');await expect(page.locator('#power')).toBeEnabled();await page.clock.install();let reads=0;
  await page.route('**/api/resources',async route=>{reads++;await route.fulfill({json:{partial:true,cpuPercent:null,memoryMB:90,processes:[{role:'server',pid:123,cpuPercent:null,memoryMB:50},{role:'effect-worker',pid:456,cpuPercent:1,memoryMB:40}]}});});
  await page.locator('.nav[data-page=settings]').click();await expect(page.locator('#health-scope')).toContainText('Leitura parcial');await expect(page.locator('#health-processes tr')).toHaveCount(2);
  await page.locator('#diagnostic-review').click();await expect(page.locator('#diagnostic-content')).toContainText('nexus-diagnostics/1');await expect(page.locator('#diagnostic-content')).not.toContainText('127.0.0.1');
  await expect(page.locator('#diagnostic-content')).toContainText('"resources"');
  await page.locator('#diagnostic-categories input[data-diag-category="resources"]').uncheck();
  await expect(page.locator('#diagnostic-content')).not.toContainText('"resources"');
  const reviewedText = (await page.locator('#diagnostic-content').textContent()) + '\n';
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#diagnostic-export').click();
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  expect(Buffer.concat(chunks).toString('utf8')).toBe(reviewedText);
  await page.locator('#settings-language').selectOption('en');await page.locator('#health-refresh').click();await expect(page.locator('#health-scope')).toContainText('Partial reading');await expect(page.locator('#health-processes')).toContainText('Effect engine');
  await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:'test-results/settings-health-en.png',fullPage:true});
  const count=reads;await page.locator('.nav[data-page=control]').click();await page.clock.fastForward(20000);expect(reads).toBe(count);
});
test.describe('descoberta com conexão persistente',()=>{
  const partial={version:'0.1.0',master:{power:true,color:'#00f0ff',brightness:80,speed:40,effect:'static'},profiles:[],presets:[],alexa:{enabled:false,status:'Desativada'},hardware:{connected:true,detecting:true,controllerCount:1,error:null,devices:[{id:'0'.repeat(24),name:'Memória RGB',vendor:'Teste',type:1,kind:'device',ledCount:8,status:'online',settings:{power:true,color:'#00f0ff',brightness:80,speed:40,effect:'static'},effects:['static'],modes:[],zones:[]}]}};
  test.use({hardwareSnapshot:partial.hardware});
test('painel distingue detecção inicial e descoberta parcial antes de declarar estado final',async({page})=>{
  await page.goto('/');await expect(page.locator('#power')).toBeEnabled();await expect(page.locator('#connection')).toHaveText('● Detectando componentes…', { timeout: 15000 });
  await expect(page.locator('#notice')).toContainText('1 encontrado(s) até agora');
  await page.locator('.nav[data-page=settings]').click();await expect(page.locator('#health-state')).toHaveText('Detectando componentes');
  await page.locator('#settings-language').selectOption('en');
  await expect(page.locator('#connection')).toHaveText('● Detecting components…', { timeout: 15000 });
  await expect(page.locator('#notice')).toContainText('1 found so far');
  await expect(page.locator('#health-state')).toHaveText('Detecting components');
});
});
test('painel exibe avisos de Iluminação Dinâmica e softwares conflitantes com tradução',async({page})=>{
  await page.route('**/api/conflicts',async route=>{
    await route.fulfill({
      json:{
        hasConflicts:true,
        dynamicLighting:{supported:true,enabled:true},
        conflicts:[{id:'icue',name:'Corsair iCUE',process:'icue.exe'}]
      }
    });
  });
  await page.goto('/');await expect(page.locator('#power')).toBeEnabled();
  await page.locator('.nav[data-page=settings]').click();
  const box=page.locator('#health-conflicts');
  await expect(box).toBeVisible();
  await expect(box).toContainText('Iluminação Dinâmica do Windows');
  await expect(box).toContainText('Corsair iCUE');
  await page.locator('#settings-language').selectOption('en');
  await expect(box).toContainText('Windows Dynamic Lighting');
  await expect(box).toContainText('Conflicting software running: Corsair iCUE');
});

