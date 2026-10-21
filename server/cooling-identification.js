'use strict';
const {createHash}=require('node:crypto');
// Names affect presentation only. IDs, selected RPM sensors and writes stay explicit.
// ASUS profile: manual lists CPU_FAN/CHA_FAN1/CHA_FAN2; HWiNFO observation and
// the ASUS Nuvoton family layout support these suggested labels. Not a wiring test.
function identify(data,preferences=[]){
 const board=data.board;
 const known=board&&/^(ASUSTeK COMPUTER INC\.|ASUS)$/i.test(board.manufacturer.trim())&&board.model.trim().toUpperCase()==='TUF GAMING A520M-PLUS II';
 const labels=['Gabinete 1 · CHA_FAN1','CPU · CPU_FAN','Gabinete 2 · CHA_FAN2'];
 const saved=new Map(preferences.map(p=>[p.key,p]));
 const controls=data.controls.map(control=>{
  const originalName=control.originalName||control.name;
  const identityKey=createHash('sha256').update(JSON.stringify([board?.manufacturer?.trim().toUpperCase()||'',board?.model?.trim().toUpperCase()||'',control.id,originalName])).digest('hex');
  const preference=saved.get(identityKey);
  const match=/^(\/lpc\/[^/]+\/\d+)\/control\/(\d+)\/control$/.exec(control.id);
  const profile=known&&match&&/^\/lpc\/nct6798d\/0$/.test(match[1]);
  const generic=/\bFan #\d+$/.test(originalName);
  const limits={minimum:Math.ceil(Math.max(20,control.min)),maximum:Math.floor(control.max)};
  return {...control,originalName,identityKey,name:preference?.name||originalName,
   limits,controllable:limits.minimum<=limits.maximum,
   ...(profile&&generic&&Number(match[2])<3?{connectorHint:labels[Number(match[2])]}:{}),
   identitySource:preference?.name?'user':generic?'generic':'backend',connection:'unconfirmed',hidden:preference?.hidden===true};
 });
 return {...data,controls};
}
module.exports={identify};
