'use strict';

// Descriptor interpretation only: no model/brand heuristics or transport writes.
function selectModes(raw){
  const direct=raw.modes.find(m=>/^direct$/i.test(m.name)&&m.flagList.includes('perLedColor')&&!m.flagList.includes('automaticSave'));
  const fixedModes=raw.modes.filter(m=>/^(?:direct|static|solid(?: color)?|fixed(?: color)?|custom)$/i.test(m.name)&&(m.flagList.includes('perLedColor')||m.flagList.includes('modeSpecificColor')));
  const fixed=direct||fixedModes.find(m=>!m.flagList.includes('automaticSave'))||fixedModes[0];
  const off=raw.modes.find(m=>/^(off|disabled|blackout)$/i.test(m.name));
  return {direct,fixed,off};
}

function nativeOffMode(raw,preferredId){
  const candidates=raw.modes.filter(mode=>mode.flagList.includes('brightness')&&!mode.flagList.includes('automaticSave')&&mode.brightnessMin===0&&Number.isInteger(mode.brightnessMax)&&mode.brightnessMax>0);
  return candidates.find(mode=>mode.id===preferredId)||candidates.find(mode=>mode.id===raw.activeMode)||candidates[0];
}
module.exports={selectModes,nativeOffMode};
