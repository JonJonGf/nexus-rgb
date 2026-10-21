'use strict';
const {CoolingBridge}=require('../../server/cooling-bridge');
const bridge=new CoolingBridge({simulated:true,brokered:true});
process.stdin.once('data',async()=>{
  try{
    await bridge.request({action:'open'});
    await bridge.request({action:'apply',values:[{id:'fan-1',percent:100}]});
    process.stdout.write(String(bridge.pid)+'\n');
    setInterval(()=>bridge.request({action:'sample'}).catch(()=>{}),1000);
  }catch(error){process.stderr.write(error.stack);process.exit(1);}
});
