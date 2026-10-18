'use strict';
// Native protocol fixture only: never loads HID, SDK, network or installation code.
const readline=require('node:readline');
process.stdout.write('\uFEFF'+JSON.stringify({status:'ready',version:'fixture'})+'\n');
readline.createInterface({input:process.stdin}).on('line',line=>{
  const command=JSON.parse(line);
  const response=command.action==='enumerate'?[{path:'synthetic-device',vid:'0x258A',pid:'0x00EC',featLen:65,usagePage:65280}]
    :command.path==='unavailable'?{status:'error',message:'open_failed'}:{status:'ok'};
  process.stdout.write(JSON.stringify(response)+'\n');
});
