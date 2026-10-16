const {test,expect}=require('./fixture');
test.use({serviceWorkers:'block'});
test('biblioteca guarda favoritos/categorias, copia efeito sem substituir original e salva transição',async({page})=>{
  await page.goto('/');await expect(page.locator('#power')).toBeEnabled();await page.locator('.nav[data-page=studio]').click();await page.locator('#studio-choose').click();
  const card=page.locator('.library-entry').filter({has:page.locator('.library-card[data-kind=spatial] strong', {hasText:'Aurora espacial'})}).first();await card.locator('.library-star').click();await expect(card.locator('.library-star')).toHaveAttribute('aria-pressed','true');
  await card.locator('summary').click();await card.getByRole('textbox',{name:'Categoria: Aurora espacial',exact:true}).fill('Meu setup');await card.getByRole('textbox',{name:'Categoria: Aurora espacial',exact:true}).press('Tab');
  await expect.poll(async()=> (await (await page.request.get('/api/state')).json()).library.categories).toHaveProperty(Object.keys((await (await page.request.get('/api/state')).json()).library.categories).find(k=>k.startsWith('spatial:')),'Meu setup');
  await page.locator('#library-category').selectOption('Meu setup');await expect(page.locator('.library-card')).toHaveCount(1);await page.locator('#library-favorites').click();await expect(page.locator('.library-card')).toHaveCount(1);
  await page.locator('.library-entry summary').click();await page.getByRole('button',{name:'Criar cópia',exact:true}).click();await expect(page.locator('#studio-formula-dialog')).toBeVisible();await expect(page.locator('#formula-name')).toHaveValue('Aurora espacial cópia');await page.locator('#studio-formula-close').click();
  const effects=(await (await page.request.get('/api/studio')).json()).effects;expect(effects.some(e=>e.name==='Aurora espacial')).toBe(true);expect(effects.some(e=>e.name==='Aurora espacial cópia')).toBe(true);
  await page.locator('.nav[data-page=settings]').click();await page.locator('#library-transition').selectOption('300');await expect.poll(async()=> (await (await page.request.get('/api/state')).json()).library.transitionMs).toBe(300);
});
