const {test,expect}=require('./fixture');
test.use({serviceWorkers:'block'});
test('central mostra escopo parcial e diagnóstico revisável sem transmissão externa',async({page})=>{
  await page.goto('/');await expect(page.locator('#power')).toBeEnabled();await page.clock.install();let reads=0;
  await page.route('**/api/resources',async route=>{reads++;await route.fulfill({json:{partial:true,cpuPercent:null,memoryMB:90,processes:[{role:'server',pid:123,cpuPercent:null,memoryMB:50},{role:'effect-worker',pid:456,cpuPercent:1,memoryMB:40}]}});});
  await page.locator('.nav[data-page=settings]').click();await expect(page.locator('#health-scope')).toContainText('Leitura parcial');await expect(page.locator('#health-processes tr')).toHaveCount(2);
  await page.locator('#diagnostic-review').click();await expect(page.locator('#diagnostic-content')).toContainText('nexus-diagnostics/1');await expect(page.locator('#diagnostic-content')).not.toContainText('127.0.0.1');
  await page.locator('#settings-language').selectOption('en');await page.locator('#health-refresh').click();await expect(page.locator('#health-scope')).toContainText('Partial reading');await expect(page.locator('#health-processes')).toContainText('Effect engine');
  await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:'test-results/settings-health-en.png',fullPage:true});
  const count=reads;await page.locator('.nav[data-page=control]').click();await page.clock.fastForward(20000);expect(reads).toBe(count);
});
test('painel distingue detecção inicial e descoberta parcial antes de declarar estado final',async({page})=>{
  const partial={version:'0.1.0',master:{power:true,color:'#00f0ff',brightness:80,speed:40,effect:'static'},profiles:[],presets:[],alexa:{enabled:false,status:'Desativada'},hardware:{connected:true,detecting:true,controllerCount:1,error:null,devices:[{id:'0'.repeat(24),name:'Memória RGB',vendor:'Teste',type:1,kind:'device',ledCount:8,status:'online',settings:{power:true,color:'#00f0ff',brightness:80,speed:40,effect:'static'},effects:['static'],modes:[],zones:[]}]}};
  await page.route('**/api/state',route=>route.fulfill({json:partial}));
  await page.route('**/api/events',route=>route.fulfill({headers:{'Content-Type':'text/event-stream'},body:`retry: 60000\ndata: ${JSON.stringify(partial)}\n\n`}));
  await page.goto('/');await expect(page.locator('#connection')).toHaveText('● Detectando componentes…');
  await expect(page.locator('#notice')).toContainText('1 encontrado(s) até agora');
  await page.locator('.nav[data-page=settings]').click();await expect(page.locator('#health-state')).toHaveText('Detectando componentes');
  await page.locator('#settings-language').selectOption('en');
  await expect(page.locator('#connection')).toHaveText('● Detecting components…');
  await expect(page.locator('#notice')).toContainText('1 found so far');
  await expect(page.locator('#health-state')).toHaveText('Detecting components');
});
