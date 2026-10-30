const {test,expect}=require('./fixture');
test('old preview reconnect cannot replace a new connection after leaving and returning to the map',async({page})=>{
  await page.addInitScript(()=>{
    const Original=window.EventSource;window.fixturePreviews=[];
    window.EventSource=class {
      constructor(url){if(!String(url).endsWith('/api/studio/preview'))return new Original(url);this.url=url;this.closed=false;window.fixturePreviews.push(this);}
      close(){this.closed=true;}
    };
  });
  await page.goto('/');await expect(page.locator('#power')).toBeEnabled();
  await page.locator('.nav[data-page=studio]').click();await expect.poll(()=>page.evaluate(()=>fixturePreviews.length)).toBe(1);
  let held=false,release;const gate=new Promise(resolve=>release=resolve);
  await page.route('**/api/studio',async route=>{if(!held){held=true;await gate;}await route.continue();});
  try{
    await page.evaluate(()=>fixturePreviews[0].onerror());
    await expect.poll(()=>held).toBe(true);
    await page.locator('.nav[data-page=control]').click();await page.locator('.nav[data-page=studio]').click();
    await expect.poll(()=>page.evaluate(()=>fixturePreviews.length)).toBe(2);
    release();await page.unrouteAll({behavior:'wait'});
    await expect.poll(()=>page.evaluate(()=>fixturePreviews.filter(source=>!source.closed).length)).toBe(1);
    expect(await page.evaluate(()=>fixturePreviews.length)).toBe(2);
  }finally{release();await page.unrouteAll({behavior:'wait'});}
});
