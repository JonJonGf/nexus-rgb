'use strict';
const { test, expect } = require('./fixture');
test.use({ serviceWorkers: 'block' });

test('idioma persiste sem alterar luzes, perfis ou o rascunho do editor', async ({ page }) => {
  const errors=[]; page.on('pageerror', e=>errors.push(e.message));
  await page.goto('/'); await expect(page.locator('#power')).toBeEnabled();
  await page.locator('[data-page=profiles]').first().click(); await page.locator('#create-profile').click();
  await page.locator('#profile-name').fill('Meu perfil — Test 夜');
  await page.locator('#profile-effect').selectOption('scanner');
  await page.locator('[data-page=settings]').click();
  const writes=[]; page.on('request', r=>{if(r.method()!=='GET' && new URL(r.url()).pathname.startsWith('/api/')) writes.push(r.url());});
  await page.locator('#settings-language').selectOption('en');
  await expect(page.locator('html')).toHaveAttribute('lang','en');
  await expect(page.locator('#page-title')).toHaveText('Settings');
  await expect(page.locator('#settings-fps-save')).toHaveText('Save frame rate');
  await page.locator('[data-page=profiles]').first().click();
  await expect(page.locator('#profile-name')).toHaveValue('Meu perfil — Test 夜');
  await expect(page.locator('#profile-effect')).toHaveValue('scanner');
  await expect(page.locator('#profile-effect option[value=scanner]')).toHaveText('Scanner');
  await expect(page.locator('#preset-gallery')).toContainText('Ember');
  await page.locator('#cancel-profile').click();
  await page.locator('[data-page=studio]').click(); await page.locator('#studio-choose').click();
  await expect(page.locator('#studio-picker-title')).toHaveText('What shall we play?');
  await page.locator('#studio-library-search').fill('rainbow');
  await expect(page.locator('.library-card')).toHaveCount(1);
  await expect(page.locator('.library-card')).toContainText('Rainbow');
  await page.locator('#studio-picker-close').click();
  expect(writes).toEqual([]);
  await page.reload(); await expect(page.locator('#power')).toBeEnabled();
  await expect(page.locator('#page-title')).toHaveText('Lighting');
  await page.locator('[data-page=settings]').click(); await expect(page.locator('#settings-language')).toHaveValue('en');
  await page.locator('#settings-language').selectOption('pt-BR'); await expect(page.locator('#page-title')).toHaveText('Configurações');
  expect(errors).toEqual([]);
});

test('inglês padrão segue o navegador e mantém nomes do usuário sem tradução', async ({ browser }) => {
  const context=await browser.newContext({locale:'en-US',serviceWorkers:'block'}),page=await context.newPage();
  // Keep the mocked initial state stable. A fulfilled finite SSE response
  // closes immediately and races the app's intentional reconnect behavior.
  await page.addInitScript(()=>{const Native=EventSource;window.EventSource=class {constructor(url,...args){if(String(url)==='/api/events')return{close(){}};return new Native(url,...args);}};});
  await page.route('**/api/state', async route=>{const response=await route.fetch(),body=await response.json();body.profiles=[{id:'a'.repeat(24),name:'Silêncio',color:'#ff0000',settings:{effect:'wave',palette:['#ff0000'],brightness:50,speed:20}}];await route.fulfill({json:body});});
  await page.goto('/'); await expect(page.locator('#power')).toBeEnabled();
  await expect(page.locator('html')).toHaveAttribute('lang','en');
  await page.locator('[data-page=profiles]').first().click();
  await expect(page.locator('#profiles h2')).toHaveText('Silêncio');
  await expect(page.locator('#profiles')).toContainText('Wave');
  await page.locator('[data-page=studio]').click(); await page.locator('#studio-choose').click();
  await expect(page.locator('.library-card[data-kind=profile] strong')).toHaveText('Silêncio');
  for(const width of [1366,390]) {await page.setViewportSize({width,height:width>800?900:844});const box=await page.locator('#studio-picker-dialog').boundingBox();expect(box.x).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(width);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:'test-results/library-en-'+width+'.png'});}
  await context.close();
});

test('avisos em inglês e criador preservam conteúdo livre e JSON avançado', async ({ page }) => {
  await page.goto('/'); await expect(page.locator('#power')).toBeEnabled();
  await page.locator('[data-page=studio]').click(); await page.locator('#studio-choose').click(); await page.locator('#studio-new').click();
  await page.locator('#formula-name').fill('Minha onda pessoal');
  await page.locator('#formula-advanced summary').click();
  const source=JSON.stringify({format:'nexus-effect/1',name:'Meu JSON',pattern:'comet',palette:['#ff0000'],speed:10,angle:75,scale:2});
  await page.locator('#studio-source').fill(source);
  const requests=[]; page.on('request',r=>{if(r.method()==='POST')requests.push(r.url());});
  await page.evaluate(()=>NexusI18n.set('en'));
  await expect(page.locator('#formula-name')).toHaveValue('Minha onda pessoal');
  await expect(page.locator('#studio-source')).toHaveValue(source);
  await expect(page.locator('#formula-save')).toHaveText('Save to library');
  await expect(page.locator('#formula-colors input').first()).toHaveAttribute('aria-label','Effect color 1');
  expect(requests).toEqual([]);
  await page.route('**/api/studio/import',route=>route.fulfill({status:400,json:{error:'Escolha de 1 a 8 cores #RRGGBB.'}}));
  await page.locator('#formula-save').click(); await expect(page.locator('#formula-error')).toHaveText('Choose 1 to 8 #RRGGBB colors.');
  expect(await page.evaluate(()=>NexusI18n('Valor inválido: Meu campo'))).toBe('Invalid value: Meu campo');
  expect(await page.evaluate(()=>NexusI18n('constructor'))).toBe('constructor');
  await page.locator('#studio-formula-close').click();
  await page.locator('#studio-choose').click(); await page.locator('#studio-library-search').fill('no match 447');
  await expect(page.locator('#studio-library-empty')).toHaveText('No results. Try another name.');
});

test('navegador sem armazenamento continua traduzindo o painel', async ({ browser }) => {
  const context=await browser.newContext({locale:'en-GB',serviceWorkers:'block'});
  await context.addInitScript(()=>{Object.defineProperty(Storage.prototype,'getItem',{value(){throw new Error('disabled');}});Object.defineProperty(Storage.prototype,'setItem',{value(){throw new Error('disabled');}});});
  const page=await context.newPage(); await page.goto('/'); await expect(page.locator('#power')).toBeEnabled();
  await expect(page.locator('#page-title')).toHaveText('Lighting');
  await page.locator('[data-page=settings]').click(); await page.locator('#settings-language').selectOption('pt-BR');
  await expect(page.locator('#page-title')).toHaveText('Configurações'); await context.close();
});
