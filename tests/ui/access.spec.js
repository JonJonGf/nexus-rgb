const {test,expect}=require('./fixture');
test('PC chooses LAN access policy, can revoke a link and keeps its own controls',async({page})=>{
  await page.goto('/');await expect(page.locator('#power')).toBeEnabled();
  await page.locator('.nav[data-page=connect]').click();
  await expect(page.locator('#access-mode')).toHaveValue('open');
  await page.locator('#access-mode').selectOption('authorized');
  await expect(page.locator('#access-status')).toContainText('link autorizado');
  expect((await (await page.request.get('/api/access')).json()).mode).toBe('authorized');
  await page.locator('#access-revoke').click();
  await expect(page.locator('#access-status')).toContainText('link autorizado');
  await page.locator('#access-mode').selectOption('local');
  await expect(page.locator('#generate-qr')).toBeDisabled();
  await page.locator('.nav[data-page=control]').click();await expect(page.locator('#power')).toBeEnabled();
  await page.locator('.nav[data-page=connect]').click();await page.locator('#access-mode').selectOption('open');
  await expect(page.locator('#generate-qr')).toBeEnabled();
});

test('authorized link works in a LAN browser, removes its fragment and never exposes admin',async({page,browser})=>{
  await page.goto('/');await expect(page.locator('#power')).toBeEnabled();
  const origin=new URL(page.url()).origin;
  const post=(route,data)=>page.request.post(route,{headers:{Origin:origin,'X-Nexus-Client':'web'},data});
  const network=await (await page.request.get('/api/network')).json();
  test.skip(!network.urls.length,'No private LAN interface on this host.');
  await post('/api/access',{mode:'authorized'});
  const link=await (await post('/api/link',{address:new URL(network.urls[0].url).hostname})).json();
  const context=await browser.newContext();
  try{
    const mobile=await context.newPage();let attempts=0;
    await mobile.route('**/api/session/lan',route=>++attempts===1?route.fulfill({status:503,json:{error:'Fixture temporarily unavailable'}}):route.continue());
    await mobile.goto(link.link);
    await expect(mobile.locator('#power')).toBeEnabled({timeout:8000});
    expect(new URL(mobile.url()).hash).toBe('');
    await mobile.locator('.nav[data-page=connect]').click();
    await expect(mobile.locator('#admin-connections')).toBeHidden();
    expect((await (await context.request.get(new URL('/api/session',link.link).href)).json()).admin).toBe(false);
    await post('/api/access',{revoke:true});
    await expect(mobile.locator('#power')).toBeDisabled();
  }finally{await context.close();}
});
