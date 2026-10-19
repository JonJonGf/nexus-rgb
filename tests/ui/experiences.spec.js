const {test,expect}=require('./fixture');
test.use({serviceWorkers:'block'});
test('scenes can be created, played and stopped in Portuguese and English without horizontal overflow',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');
  await page.locator('.nav[data-page=experiences]').click();
  await page.locator('[data-experience-tab=scenes]').click();
  await page.locator('#scene-name').fill('Short break');await page.locator('.scene-duration').fill('1');
  await page.locator('#scene-save').click();await expect(page.locator('#scene-list')).toContainText('Short break');
  await page.locator('#scene-list button[data-play]').click();await expect(page.locator('#experience-status')).toContainText('Short break');
  await page.locator('#experience-stop').click();await expect(page.locator('#experience-status')).toContainText('Sem cena');
  await page.locator('.nav[data-page=settings]').click();await page.locator('#settings-language').selectOption('en');
  await page.locator('.nav[data-page=experiences]').click();await expect(page.locator('#page-title')).toHaveText('Experiences');
  await page.setViewportSize({width:390,height:844});await expect(page.locator('#experience-stop')).toBeVisible();
  const settings=await page.locator('.nav[data-page=settings]').boundingBox();expect(settings.x+settings.width).toBeLessThanOrEqual(390);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(errors).toEqual([]);
});

test.describe('WLED registration',()=>{
  test.use({roomOptions:async({},use)=>{
    const http=require('node:http'),server=http.createServer((req,res)=>{req.resume();res.setHeader('Content-Type','application/json');res.end(JSON.stringify(req.url==='/json/info'?{brand:'WLED',ver:'0.15.0',leds:{count:24}}:{success:true}));});await new Promise(r=>server.listen(0,'127.0.0.1',r));
    try{await use({resolveTarget:()=>({address:'127.0.0.1',port:server.address().port,ddpPort:4048})});}finally{await new Promise(r=>server.close(r));}
  }});
  test('verified network device renders in Devices and map with real descriptors',async({page})=>{
    const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');await page.locator('.nav[data-page=experiences]').click();await page.locator('[data-experience-tab=room]').click();
    await page.locator('#room-name').fill('WLED desk');await page.locator('#room-address').fill('192.168.50.2');await page.locator('#room-enabled').uncheck();await page.locator('#room-form button').click();
    await expect(page.locator('#room-list')).toContainText('WLED desk');await page.locator('.nav[data-page=devices]').click();await expect(page.locator('#devices .device-card')).toContainText('24 LEDs');
    await page.locator('.nav[data-page=studio]').click();await expect(page.locator('.studio-item')).toHaveCount(1);expect(errors).toEqual([]);
  });
});

test('Live records pointer events and replays them; audio preferences stay opt-in',async({page})=>{
  await page.goto('/');await page.locator('.nav[data-page=experiences]').click();
  await expect(page.locator('#live-record')).toBeEnabled();await page.locator('#live-record').click();
  const surface=page.locator('#live-canvas'),box=await surface.boundingBox();
  const sent=page.waitForResponse(r=>r.url().endsWith('/api/experiences/live')&&r.status()===200);
  await page.mouse.click(box.x+box.width/2,box.y+box.height/2);await sent;
  await page.locator('#live-record').click();await page.locator('#recording-name').fill('Gesture');await page.locator('#recording-save').click();
  await expect(page.locator('#recording-list')).toContainText('Gesture');
  const replay=page.waitForResponse(r=>r.url().includes('/recordings/')&&r.url().endsWith('/play'));
  await page.locator('#recording-list button').first().click();expect((await replay).status()).toBe(200);
  await page.locator('[data-experience-tab=signals]').click();await expect(page.locator('#audio-enabled')).not.toBeChecked();
  await page.locator('#audio-enabled').check();await page.locator('#audio-form button').click();
  await expect.poll(async()=>page.evaluate(async()=>{return (await(await fetch('/api/experiences')).json()).audio.enabled;})).toBe(true);
  await page.locator('#audio-enabled').uncheck();await page.locator('#audio-form button').click();
  await expect.poll(async()=>page.evaluate(async()=>{return (await(await fetch('/api/experiences')).json()).audio.enabled;})).toBe(false);
});
