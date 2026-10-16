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
