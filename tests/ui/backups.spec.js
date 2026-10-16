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
