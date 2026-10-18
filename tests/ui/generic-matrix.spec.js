const {test,expect}=require('./fixture');
test.use({serviceWorkers:'block'});
test('a generic matrix with 61 LEDs keeps its chosen column count through editing and reload',async({page})=>{
  const device={id:'1'.repeat(24),name:'Generic LED panel',type:0,ledCount:61,kind:'device',status:'online',effects:['static','wave'],modes:[],zones:[],settings:{power:true,brightness:100,effect:'static',color:'#ff0000',speed:20}};
  await page.route('**/api/state',async route=>{const response=await route.fetch(),body=await response.json();body.hardware={connected:true,controllerCount:1,devices:[device]};await route.fulfill({json:body});});
  await page.goto('/');await expect(page.locator('#power')).toBeEnabled();
  const layout=await page.evaluate(d=>NexusSpatial.defaults([d]).map(p=>({...p,shape:'matrix',columns:1})),device);
  await page.request.post('/api/studio',{headers:{Origin:new URL(page.url()).origin,'X-Nexus-Client':'web'},data:{layout,enabled:false}});
  await page.locator('[data-page=studio]').click();await page.locator('#studio-device-chips button').first().click();
  await expect(page.locator('#studio-columns')).toHaveValue('1');
  const points=await page.evaluate(()=>NexusSpatial.leds({shape:'matrix',count:61,columns:1,width:1,height:1,start:0}));
  expect(new Set(points.map(p=>p.x)).size).toBe(1);
  await page.reload();await page.locator('[data-page=studio]').click();await page.locator('#studio-device-chips button').first().click();await expect(page.locator('#studio-columns')).toHaveValue('1');
});
