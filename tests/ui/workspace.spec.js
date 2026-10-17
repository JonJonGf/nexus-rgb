const {test,expect}=require('./fixture');
test.use({serviceWorkers:'block'});

async function fixture(page) {
  const devices=[1,2].map(n=>({id:String(n).padStart(24,'a'),name:'Fan '+n,ledCount:12,type:0,kind:'argb',status:'online',settings:{power:true,color:'#00f0ff',brightness:80,effect:'static',speed:40},effects:['static'],modes:[],zones:[]}));
  await page.route('**/api/state',async route=>{const body=await (await route.fetch()).json();body.hardware={connected:true,controllerCount:2,devices};await route.fulfill({json:body});});
  await page.goto('/');await expect(page.locator('#power')).toBeEnabled();
  const layout=await page.evaluate(ds=>NexusSpatial.defaults(ds),devices);
  await page.request.post('/api/studio',{headers:{Origin:new URL(page.url()).origin,'X-Nexus-Client':'web'},data:{layout}});
  await page.locator('.nav[data-page=studio]').click();await expect(page.locator('.studio-item')).toHaveCount(2);
  return layout;
}
const saved=async page=>(await (await page.request.get('/api/studio')).json()).layout;
test('multisseleção, grupos, desfazer/refazer e alças persistem sem separar LEDs',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));const layout=await fixture(page);
  const chips=page.locator('#studio-device-chips button');await chips.first().click();await chips.last().click({modifiers:['Shift']});
  await expect(page.locator('.studio-item.selected')).toHaveCount(2);
  await page.locator('.studio-item').last().click({modifiers:['Shift']});await expect(page.locator('.studio-item.selected')).toHaveCount(1);
  await chips.last().click({modifiers:['Shift']});await expect(page.locator('.studio-item.selected')).toHaveCount(2);
  await page.locator('#map-group').fill('Fans');await page.locator('#map-group').press('Tab');
  await expect.poll(async()=> (await saved(page)).map(e=>e.group)).toEqual(['Fans','Fans']);
  await page.locator('.studio-item').first().press('ArrowRight');
  await expect(page.locator('#map-undo')).toHaveText('Desfazer posição ↶');
  await expect.poll(async()=> (await saved(page))[0].x).toBeCloseTo(layout[0].x+.01,5);
  expect((await saved(page))[1].x).toBeCloseTo(layout[1].x+.01,5);
  await page.locator('#map-undo').click();
  await expect(page.locator('#map-redo')).toHaveText('Refazer posição ↷');
  await expect.poll(async()=> (await saved(page))[0].x).toBeCloseTo(layout[0].x,5);
  await page.locator('#map-redo').click();await expect.poll(async()=> (await saved(page))[1].x).toBeCloseTo(layout[1].x+.01,5);
  await chips.first().click();const size=page.locator('.map-handle-size'),box=await size.boundingBox();expect(box.width).toBe(13);
  await page.mouse.move(box.x+6,box.y+6);await page.mouse.down();await page.mouse.move(box.x+26,box.y+16);await page.mouse.up();
  await expect(page.locator('#map-undo')).toHaveText('Desfazer tamanho ↶');
  await expect.poll(async()=> (await saved(page))[0].width).toBeGreaterThan(layout[0].width);
  await page.locator('#map-undo').click();await expect.poll(async()=> (await saved(page))[0].width).toBeCloseTo(layout[0].width,5);
  // Concurrent modification on another client triggers 409 conflict and syncs map from server:
  const currentSaved = await saved(page);
  const remoteLayout = currentSaved.map((e, idx) => idx === 0 ? { ...e, x: 0.82 } : e);
  await page.request.post('/api/studio', { headers: { Origin: new URL(page.url()).origin, 'X-Nexus-Client': 'web' }, data: { layout: remoteLayout } });
  await page.locator('.studio-item').first().press('ArrowLeft');
  await expect(page.locator('#toast')).toContainText('alterado em outro dispositivo');
  await expect.poll(async()=> (await saved(page))[0].x).toBeCloseTo(0.82, 5);
  expect(errors).toEqual([]);
});
test('calibração revisa soma dos anéis, ordem, teste temporário e persiste no mapa',async({page})=>{
  const layout=await fixture(page);await page.locator('#studio-device-chips button').first().click();await page.locator('#map-calibrate').click();
  await expect(page.locator('#calibration-dialog')).toBeVisible();
  const calls=[];await page.route('**/api/devices/*/identify',async route=>{calls.push(route.request().postDataJSON());await route.fulfill({json:{active:null}});});
  await page.locator('#calibration-test').click();await expect.poll(()=>calls.length).toBe(1);expect(calls[0]).toEqual({led:0});
  await page.locator('#calibration-rings input[type=number]').first().fill('8');await page.locator('#calibration-add-ring').click();await page.locator('#calibration-save').click();
  await expect(page.locator('#calibration-error')).not.toBeEmpty();await expect(page.locator('#calibration-dialog')).toBeVisible();
  await page.locator('.calibration-ring').last().locator('input[type=number]').first().fill('4');
  await page.locator('#calibration-dialog details summary').click();await page.locator('#calibration-order').fill(Array.from({length:12},(_,i)=>12-i).join(', '));await page.locator('#calibration-wiring').selectOption('sequential');await page.locator('#calibration-save').click();
  await expect(page.locator('#calibration-dialog')).not.toBeVisible();
  await expect.poll(async()=> (await saved(page))[0].rings?.map(r=>r.count)).toEqual([8,4]);
  const first=(await saved(page))[0];expect(first.ledOrder).toEqual(Array.from({length:12},(_,i)=>11-i));expect(first.wiring).toBe('sequential');expect(first.count).toBe(layout[0].count);
  await page.reload();await page.locator('.nav[data-page=studio]').click();await page.locator('#studio-device-chips button').first().click();await page.locator('#map-calibrate').click();await expect(page.locator('.calibration-ring')).toHaveCount(2);
  await page.locator('#calibration-dialog').getByRole('button',{name:'Fechar',exact:true}).click();
  await page.locator('.nav[data-page=settings]').click();await page.locator('#settings-language').selectOption('en');await page.locator('.nav[data-page=studio]').click();await page.locator('#map-calibrate').click();await expect(page.locator('#calibration-title')).toHaveText('Calibrate device');
  await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
