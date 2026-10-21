'use strict';
// Names affect presentation only. IDs, selected RPM sensors and writes stay explicit.
// ASUS profile: manual lists CPU_FAN/CHA_FAN1/CHA_FAN2; HWiNFO observation and
// the ASUS Nuvoton family layout support these suggested labels. Not a wiring test.
function identify(data){
 const board=data.board;
 const known=board&&/^(ASUSTeK COMPUTER INC\.|ASUS)$/i.test(board.manufacturer.trim())&&board.model.trim().toUpperCase()==='TUF GAMING A520M-PLUS II';
 const labels=['Gabinete 1 · CHA_FAN1','CPU · CPU_FAN','Gabinete 2 · CHA_FAN2'];
 const controls=data.controls.map(control=>{
  const match=/^(\/lpc\/[^/]+\/\d+)\/control\/(\d+)\/control$/.exec(control.id);
  const candidate=match&&data.fans.find(f=>f.id===match[1]+'/fan/'+match[2]);
  const profile=known&&match&&/^\/lpc\/nct6798d\/0$/.test(match[1]);
  const generic=/\bFan #\d+$/.test(control.name);
  return {...control,originalName:control.name,
   ...(profile&&Number(match[2])<3?{name:labels[Number(match[2])],identitySource:'board-suggestion'}:{identitySource:generic?'generic':'backend'}),
   ...(candidate?{suggestedRpmId:candidate.id}:{}),
   useful:Boolean(profile&&Number(match[2])<3||candidate?.value>0||!generic)};
 });
 return {...data,controls};
}
module.exports={identify};
