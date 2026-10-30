'use strict';
const {test,expect}=require('@playwright/test'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createApp}=require('../../server');
test.use({serviceWorkers:'block'});
test('fan curve, sensors and active state return in the browser after restarting the entire service',async({page},testInfo)=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'nexus-cooling-boot-ui-'));
 let backendReady=true;
 const options={directory,disableHardware:true,disableAlexa:true,disableWelcome:true,listenHost:'127.0.0.1',cooling:{autoPoll:false,bridgeFactory:()=>({async request(body){
  if(body.action==='open'&&!backendReady)throw Error('Fixture: helper not ready');
  if(body.action==='open'||body.action==='sample')return {at:Date.now(),simulated:true,board:{manufacturer:'Fixture',model:'Board'},sensors:[{id:'cpu',name:'CPU package',value:60}],controls:[{id:'fan-a',name:'CPU fan',min:0,max:100}],fans:[{id:'rpm-a',name:'CPU fan RPM',value:1200}]};return {released:true};
 },async close(){}})}};
 let app;
 try{
  app=await createApp({...options,localPort:0});const {localPort}=await app.start(),origin='http://127.0.0.1:'+localPort;
  await page.goto(origin);await page.locator('.nav[data-page=cooling]').click();await page.locator('#cooling-monitor').click();
  const row=page.locator('.cooling-channel').first();await row.getByLabel('Controlar este canal').check();await row.getByLabel('Sensor de temperatura',{exact:true}).selectOption('cpu');await row.getByLabel('Leitura de RPM',{exact:true}).selectOption('rpm-a');await row.getByLabel('Modo de controle',{exact:true}).selectOption('manual');await row.getByLabel('Velocidade do ponto').nth(2).fill('72');await row.getByLabel('Traçado da curva',{exact:true}).selectOption('smooth');
  await page.locator('#cooling-enabled').check();await expect(page.locator('#cooling-mode')).toContainText('Controle ativo');
  await app.stop();app=await createApp({...options,localPort});await app.start();await page.reload();await page.locator('.nav[data-page=cooling]').click();
  await expect(page.locator('#cooling-enabled')).toBeChecked();await expect(row.getByLabel('Sensor de temperatura',{exact:true})).toHaveValue('cpu');await expect(row.getByLabel('Leitura de RPM',{exact:true})).toHaveValue('rpm-a');await expect(row.getByLabel('Modo de controle',{exact:true})).toHaveValue('manual');await expect(row.getByLabel('Velocidade do ponto').nth(2)).toHaveValue('72');await expect(row.getByLabel('Traçado da curva',{exact:true})).toHaveValue('smooth');
  await expect(page.locator('#cooling-resume')).toContainText('retomada ao iniciar');
  await page.locator('#cooling-resume').scrollIntoViewIfNeeded();await page.screenshot({path:testInfo.outputPath('resume-desktop.png')});
  await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.locator('#cooling-resume').scrollIntoViewIfNeeded();await page.screenshot({path:testInfo.outputPath('resume-mobile.png')});
  const profile={id:'custom-'+'a'.repeat(32),name:'Saved curve',points:[[20,40],[60,55],[100,100]],interpolation:'linear'},post=async data=>{const response=await page.request.post(origin+'/api/cooling',{headers:{Origin:origin,'X-Nexus-Client':'web'},data});expect(response.status()).toBe(200);};
  await post({customProfiles:[profile]});await post({enabled:true,profile:profile.id,assignments:[{controlId:'fan-a',sensorId:'cpu',rpmId:'rpm-a',minPercent:40,critical:85}]});await post({customProfiles:[{...profile,points:[[20,40],[60,80],[100,100]]}]});
  await app.stop();app=await createApp({...options,localPort});await app.start();await page.reload();await page.locator('.nav[data-page=cooling]').click();await expect(row.getByLabel('Velocidade do ponto').nth(1)).toHaveValue('55');await expect(page.locator('#cooling-mode')).toContainText('Perfil alterado');
  await page.locator('#cooling-profiles button[data-profile="'+profile.id+'"]').click();await expect(row.getByLabel('Velocidade do ponto').nth(1)).toHaveValue('80');
  await app.stop();backendReady=false;app=await createApp({...options,localPort});await app.start();await page.reload();await page.locator('.nav[data-page=cooling]').click();
  await expect(page.locator('#cooling-mode')).toContainText('Aguardando sensores');await expect(page.locator('#cooling-resume')).toContainText('Configuração preservada');await expect(page.locator('#cooling-stop')).toBeEnabled();await page.locator('#cooling-stop').click();await expect(page.locator('#cooling-mode')).toContainText('Desligado');backendReady=true;await page.waitForTimeout(1100);await expect(page.locator('#cooling-enabled')).not.toBeChecked();
  await page.locator('.nav[data-page=settings]').click();await page.locator('#settings-language').selectOption('en');await page.locator('.nav[data-page=cooling]').click();await expect(page.locator('#cooling-resume')).toContainText('Curves and assignments saved');
 }finally{await app?.stop();const target=path.resolve(directory);if(path.dirname(target)!==path.resolve(os.tmpdir())||!path.basename(target).startsWith('nexus-cooling-boot-ui-'))throw Error('Invalid cooling UI fixture directory');fs.rmSync(target,{recursive:true,force:true});}
});
