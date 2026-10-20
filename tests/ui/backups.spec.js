const {test,expect}=require('./fixture');
test.use({serviceWorkers:'block'});
test('backup só restaura depois da revisão e invalida estado alterado depois dela',async({page})=>{
  await page.goto('/');await expect(page.locator('#power')).toBeEnabled();await page.locator('.nav[data-page=settings]').click();
  const backup=await (await page.request.get('/api/backups')).json(),headers={Origin:new URL(page.url()).origin,'X-Nexus-Client':'web'};
  const file={name:'backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))};
  await page.locator('#backup-import').setInputFiles(file);await expect(page.locator('#backup-review')).toBeVisible();await expect(page.locator('#backup-summary')).toContainText('perfis');
  await page.request.post('/api/control',{headers,data:{color:backup.settings.master.color==='#ff0000'?'#00ff00':'#ff0000'}});await page.locator('#backup-restore').click();await expect(page.locator('#backup-status')).toContainText('mudaram');
  await page.locator('#backup-import').setInputFiles(file);await expect(page.locator('#backup-restore')).toBeEnabled();
  await page.locator('#backup-restore').click();await expect(page.locator('#power')).toBeEnabled();
  await expect.poll(async()=> (await (await page.request.get('/api/state')).json()).master.color).toBe(backup.settings.master.color);
});

test('backup recovery needs explicit omission and never drops an effect referenced by the map',async({page})=>{
  await page.goto('/');await page.locator('.nav[data-page=settings]').click();
  const backup=await(await page.request.get('/api/backups')).json();
  const source='<title>Rejected drawing</title><canvas id="c"></canvas><script>var c=document.getElementById("c").getContext("2d");for(var n=0;n<31000;n++)c.fillRect(0,0,1,1);</script>',id=require('node:crypto').createHash('sha256').update(source).digest('hex').slice(0,24);
  backup.effects=[{id,original:source}];const file=value=>({name:'backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(value))});
  await page.locator('#backup-import').setInputFiles(file(backup));await expect(page.locator('#backup-status')).toContainText('Rejected drawing');await expect(page.locator('#backup-skip-effect')).toBeVisible();await expect(page.locator('#backup-restore')).toBeDisabled();
  await page.locator('#backup-skip-effect').click();await expect(page.locator('#backup-review')).toBeVisible();await expect(page.locator('#backup-omitted')).toContainText('Rejected drawing');
  expect((await(await page.request.get('/api/backups')).json()).effects).toEqual([]);
  const restored=page.waitForResponse(r=>r.url().endsWith('/api/backups/restore'));await page.locator('#backup-restore').click();expect((await restored).status()).toBe(200);await expect(page.locator('#power')).toBeEnabled();await page.locator('.nav[data-page=settings]').click();expect(backup.effects[0].original).toBe(source);
  const referenced=structuredClone(backup);referenced.settings.studio={enabled:false,activeId:id,values:{},layout:[],excluded:[]};
  await page.locator('#backup-import').setInputFiles(file(referenced));await expect(page.locator('#backup-status')).toContainText('referenciado');await expect(page.locator('#backup-skip-effect')).toBeHidden();await expect(page.locator('#backup-restore')).toBeDisabled();
  await page.locator('#settings-language').selectOption('en');await page.locator('#backup-import').setInputFiles(file(backup));await expect(page.locator('#backup-status')).toContainText('did not pass validation');await expect(page.locator('#backup-skip-effect')).toHaveText('Review without this effect');
});
