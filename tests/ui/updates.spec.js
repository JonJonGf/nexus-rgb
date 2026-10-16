const {test,expect}=require('./fixture');
test.use({serviceWorkers:'block'});
test('consulta opcional não gera rede externa antes do clique e só abre release oficial',async({page})=>{
  await page.goto('/');await expect(page.locator('#power')).toBeEnabled();let external=0;
  await page.route('https://api.github.com/**',async route=>{external++;expect(route.request().url()).toBe('https://api.github.com/repos/JonJonGf/nexus-rgb/releases?per_page=10');await route.fulfill({json:[{tag_name:'v0.1.0-alpha.15',draft:false,html_url:'https://attacker.invalid',assets:['NexusRGB-Setup-0.1.0.exe','SHA256SUMS.txt','BUILD-INFO.json'].map(name=>({name,state:'uploaded',size:100}))}]});});
  const home=await page.request.get('/');expect(home.headers()['content-security-policy']).not.toContain('api.github.com');
  await page.goto('/updates');await expect(page.locator('#update-check')).toBeEnabled();expect(external).toBe(0);
  await page.locator('#update-check').click();await expect(page.locator('#update-result')).toContainText('v0.1.0-alpha.15');expect(external).toBe(1);await expect(page.locator('#update-download')).toHaveAttribute('href','https://github.com/JonJonGf/nexus-rgb/releases/tag/v0.1.0-alpha.15');
  await page.route('https://api.github.com/**',route=>route.abort());await page.locator('#update-check').click();await expect(page.locator('#update-result')).toContainText('Consulta indisponível');await expect(page.locator('#update-download')).toBeHidden();
});
