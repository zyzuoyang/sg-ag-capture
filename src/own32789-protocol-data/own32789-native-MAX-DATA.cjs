'use strict';
// Request DATA projection of own native base MAX close. No UI/timer/callback actor.
exports.createOwn32789NativeMAXDATA=function({DOM,vm,data,game,need}){
 const context=vm.createContext({}),fn=s=>vm.runInContext('('+s+')',context,{timeout:100});
 const tag=fn(data.automaticFree.randomWildLeaves.getRandomWildFeatureTag.source),parseRandom=fn(data.automaticFree.randomWildLeaves.parseRandomFeatureInfo.source);
 const one=(n,t)=>{const a=Array.from(n?.childNodes||[]).filter(x=>x.nodeType===1&&x.nodeName===t);need(a.length===1,'native base MAX one '+t);return a[0]},integer=(n,k)=>{const a=n?.attributes?.getNamedItem(k);need(a&&/^[0-9]+$/.test(a.value)&&Number.isSafeInteger(Number(a.value)),'actual native MAX '+k);return Number(a.value)};
 return Object.freeze({baseNext(text){
  need(typeof text==='string'&&!/<!DOCTYPE/i.test(text),'native MAX raw XML');const d=new DOM.DOMParser().parseFromString(text,'text/xml'),r=d.documentElement;
  need(r?.nodeName==='GameResponse'&&r.getAttribute('type')==='Logic'&&!d.getElementsByTagName('Error').length&&!d.getElementsByTagName('Errors').length&&!d.getElementsByTagName('parsererror').length,'native MAX successful Logic');
  const h=one(r,'Header'),g=one(r,'GameResult'),b=one(g,'BaseGame'),features=Array.from(r.getElementsByTagName('Feature')),primary=features[0]?.getAttribute('index');
  need(h.getAttribute('gameID')==='20106'&&h.getAttribute('versionID')==='1_0'&&h.getAttribute('isRecovering')==='N','native MAX original nonrecovery Header');
  need(b.getAttribute('isMaxWin')==='Y'&&primary!=='1'&&primary!=='2','native base MAX cannot skip Free/Pick source entry');need(integer(g,'stake')===game.sg.betRaw,'native MAX current wager');
  need(d.getElementsByTagName('ReelSpin').length>0,'native MAX actual native reel response');if(primary==='3')parseRandom.call({getRandomWildFeatureTag:tag},features);
  const win=b.attributes.getNamedItem('totalWagerWin')?integer(b,'totalWagerWin'):integer(g,'totalWin');
  // Native state0 -> handleMaxWinHit -> Bangup -> sendEndGame; native RandomWild state1 returns to state0 first. Source proof is separate immutable DATA.
  return Object.freeze({event:'EndGame',action:'PLAY',sourceCumulativeWin:win,sourceRoute:'own-native-base-MAX-to-real-End-request',requestNotSent:true,actualEndACK:false,displayPipelineExecuted:false,displayCallbacksProduced:0});
 }});
};
