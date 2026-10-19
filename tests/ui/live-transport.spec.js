'use strict';
const {test,expect}=require('@playwright/test'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {Client}=require('openrgb-sdk'),{Store}=require('../../server/store'),{Hardware}=require('../../server/hardware'),{createApp}=require('../../server');

test('holding and circling in Live keeps SDK transport connected with overlapping gestures',async({page})=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'nexus-live-browser-')),store=new Store(directory);
  store.master({power:true,brightness:100,color:'#ffffff',effect:'static'});store.performance({fps:60});
  let connections=0,packets=0;const failures=[],responses=[];
  class SDK extends Client {
    constructor(){super('Fixture',6742,'127.0.0.1');}
    async connect(){connections++;} async getControllerCount(){return 3;}
    async getControllerData(index){return {name:'Fixture '+index,vendor:'Fixture',location:index<2?'SMBus:'+index:'USB:board',type:index<2?1:0,serial:'',zones:[],colors:Array.from({length:index<2?8:36},()=>({red:0,green:0,blue:0})),modes:[{id:2,name:'Direct',flagList:['perLedColor']}]};}
    async updateMode(){} sendMessage(command){if(command===1050)packets++;} disconnect(){}
  }
  // External SDK/HID boundaries only; the browser, HTTP app, composition,
  // hardware scheduling and SDK byte encoder remain the production code.
  const hardware=new Hardware(store,{makeClient:()=>new SDK(),controllerRegistry:{getDevices:()=>[],getSummary:()=>[],destroy(){}}});
  const app=await createApp({directory,store,hardware,localPort:0,disableHardware:true,disableAlexa:true,disableWelcome:true});
  try{
    const {localPort}=await app.start();hardware.stopped=false;await hardware.connect();hardware.setFps();
    page.on('pageerror',e=>failures.push(e.message));page.on('response',r=>{if(r.url().endsWith('/api/experiences/live'))responses.push(r.status());});
    await page.goto('http://127.0.0.1:'+localPort);await page.locator('.nav[data-page=experiences]').click();
    const box=await page.locator('#live-canvas').boundingBox();expect(box).toBeTruthy();
    await page.mouse.move(box.x+box.width*.58,box.y+box.height*.5);await page.mouse.down();
    for(let n=0;n<60;n++){const t=n*.4;await page.mouse.move(box.x+box.width*(.5+.08*Math.cos(t)),box.y+box.height*(.5+.08*Math.sin(t)));await page.waitForTimeout(35);}
    await page.mouse.up();await expect.poll(()=>responses.length).toBeGreaterThanOrEqual(8);
    const state=await page.evaluate(async()=>(await fetch('/api/state')).json());expect(state.hardware.connected,state.hardware.error).toBe(true);expect(state.hardware.error).toBeNull();
    expect(connections,'Live must not trigger SDK reconnections').toBe(1);expect(packets).toBeGreaterThan(10);expect(responses.every(status=>status===200)).toBe(true);expect(failures).toEqual([]);
  }finally{
    await app.stop();const target=path.resolve(directory);if(path.dirname(target)!==path.resolve(os.tmpdir())||!path.basename(target).startsWith('nexus-live-browser-'))throw Error('Invalid fixture directory');fs.rmSync(target,{recursive:true,force:true});
  }
});
