'use strict';
// Real browser -> isolated HTTP app -> native fixture executable. No sensors or fan writes.
const {spawn}=require('node:child_process'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{chromium}=require('@playwright/test');
async function main(){
  const directory=path.resolve('data/cooling-dev/integrated-'+Date.now());fs.mkdirSync(directory,{recursive:true});
  const child=spawn(process.execPath,['scripts/dev-cooling.cjs','--simulate','--supervised','--port','0','--data',directory],{windowsHide:true,stdio:['pipe','pipe','pipe']});let browser;
  try{
    const ready=await new Promise((resolve,reject)=>{let buffer='';const timer=setTimeout(()=>reject(Error('Preview startup timeout')),10000);child.stdout.on('data',chunk=>{buffer+=chunk;for(const line of buffer.split(/\r?\n/)){try{const value=JSON.parse(line);if(value.url){clearTimeout(timer);resolve(value);return;}}catch{}}});child.on('error',reject);child.on('exit',()=>reject(Error('Preview exited')));});
    browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage({viewport:{width:1366,height:900}});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(ready.url);await page.locator('#power').waitFor();await page.locator('.nav[data-page=cooling]').click();
    await page.locator('#cooling-monitor').click();await page.locator('.cooling-channel').first().waitFor();assert.equal(await page.locator('.cooling-channel').count(),6);
    const row=page.locator('.cooling-channel').first();await row.getByLabel('Controlar este canal').check();await row.getByLabel('Sensor de temperatura',{exact:true}).selectOption('cpu');await row.getByLabel('Leitura de RPM',{exact:true}).selectOption('rpm-1');
    await page.locator('#cooling-enabled').check();await page.locator('#cooling-profiles button[data-profile=turbo]').click();
    await page.waitForFunction(()=>document.querySelector('.cooling-output').textContent.includes('2000 RPM'));
    await page.screenshot({path:path.join(directory,'desktop.png'),fullPage:true});
    await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(directory,'mobile.png'),fullPage:true});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    await page.locator('#cooling-stop').click();await page.waitForFunction(()=>document.querySelector('#cooling-mode').textContent==='Desligado');
    assert.equal(await page.locator('.cooling-channel').count(),0);assert.deepEqual(errors,[]);
    console.log('Integrated simulated preview passed: 6 channels, explicit pairing, TURBO with fixture RPM, responsive UI and module shutdown. Evidence: '+directory);
  }finally{await browser?.close();child.stdin.end('shutdown\n');await new Promise(resolve=>{if(child.exitCode!==null)resolve();else child.once('exit',resolve);});}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
