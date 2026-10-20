'use strict';
const vm=require('node:vm');
// Own protocol function ports only. INIT/account and the original AG adapter
// must still be connected before this can dispatch or store production data.
exports.createNativeOrdinaryControl=function({protocolData,controlData,nativeAccountConnection}){
 const need=(x,s)=>{if(!x)throw Error('CHERRY32477_NATIVE_'+s)};
 const leaves=[...protocolData.leaves,...controlData.leaves],source=name=>{const x=leaves.find(l=>l.name===name);need(x,'SOURCE_'+name);return x.source};
 const literal=controlData.actualOwnConfigLiterals;need(literal.lineBet==='8'&&literal.msBetweenSpins==='0','OWN_CONFIG');
 const requests=[],responses=[],events=[];let begun=false,sealed=false,ended=false,frame=null,stake;
 const broadcast=name=>(...args)=>{events.push({event:name,args});if(name==='gameEnded')ctx.adaptor.onGameEnded(...args)};
 const wrapper={sendMsgToServer:raw=>requests.push(raw),valueChanged:(name,value)=>{events.push({event:'wrapper',name,value});if(name==='ROUND'&&value===0){need(frame&&begun&&!ended,'CURRENT_NATIVE_ROUND_CALLBACK');ended=true}}};
 const config={lineBet:8,winType:'line',msBetweenSpins:Number(literal.msBetweenSpins),defaultEventCheckTimer:Number(literal.defaultEventCheckTimer)};
 const game={autoplayController:{active:false},reelManager:{timeOfSpin:0},platform:{buyBonus:{haveUsedBuyPass:false},buttons:{}},betController:{getTotalStake:()=>stake*config.lineBet},inPromoGames:()=>false,gameState:{setState:s=>{need(s==='IDLE','ACTUAL_FREE_OR_FEATURE_NEXT_UNMAPPED');events.push({event:'nativeState',state:s})}}};
 const ctx=vm.createContext({Wrapper:wrapper,config,debug(){},console:{error(){}},ie:()=>name=>({broadcast:broadcast(name)}),h:()=>name=>({broadcast:broadcast(name)}),tt:{Ticker:{shared:{lastTime:0}}},FA:game,
  l:{A:value=>typeof value},
  d:{A:(obj,ctor)=>need(obj instanceof ctor,'ORIGINAL_CONSTRUCTOR_RECEIVER')},m:{A:(obj,key,value)=>Object.defineProperty(obj,key,{value,enumerable:true,configurable:true,writable:true})},
  GSAP:{delayedCall:()=>need(false,'ACTUAL_DELAYED_CONTROL_NOT_MAPPED')}});
 const code='var NativeFreeSpins=('+source('nativeFreeSpinsModel')+');var engineComms={sendRequest:function(raw){Wrapper.sendMsgToServer(raw)}};'+
  ['sendBetRequest','sendFreespinRequest','gameBusy','gameFree'].map(n=>'engineComms.'+n+'=('+source(n)+');').join('')+
  'var adaptor={engineComms:engineComms,onGameStarted:('+source('nativeOnGameStarted')+'),onGameEnded:('+source('onGameEnded')+')};';
 vm.runInContext(code,ctx,{timeout:1000});game.readyForNextSpin=vm.runInContext('('+source('nativeReadyForNextSpin')+')',ctx,{timeout:1000});
 function guarded(fn){need(!sealed,'SEALED_OUTCOME');try{return fn()}catch(e){sealed=true;throw e}}
 return Object.freeze({
  startOrdinaryRequest(input){return guarded(()=>{need(!begun,'ONE_ORIGINAL_REQUEST');need(nativeAccountConnection&&nativeAccountConnection.status().state==='ready'&&!nativeAccountConnection.status().sealed,'NATIVE_INIT_ACCOUNT_REQUIRED');need(input&&Number.isSafeInteger(input.stake)&&input.stake>0&&nativeAccountConnection.status().allowedStakes.includes(input.stake)&&input.autoplay===false&&input.freespin===false&&input.gambleChoice===0&&input.buyin===0,'ACTUAL_PAID_REQUEST_INPUT');stake=input.stake;game.reelManager.timeOfSpin=Date.now();ctx.adaptor.onGameStarted(input);need(requests.length===1&&events.some(x=>x.name==='ROUND'&&x.value===1),'ORIGINAL_PAID_REQUEST_AND_BUSY');nativeAccountConnection.bindNativePaidRequest(requests[0]);begun=true;return requests[0]})},
  acceptSuccessfulOrdinaryResponse(raw,httpStatus){return guarded(()=>{
   responses.push({raw,httpStatus});need(begun&&!frame&&!ended&&typeof raw==='string'&&Number.isInteger(httpStatus)&&httpStatus>=200&&httpStatus<300,'ONE_SUCCESSFUL_CURRENT_RESPONSE');
   const fields={};for(const bit of raw.split('&')){const i=bit.indexOf('=');if(i<0)continue;const k=bit.slice(0,i),v=bit.slice(i+1);need(!Object.hasOwn(fields,k),'DUPLICATE_RESPONSE_MARKER');fields[k]=v}
   need(fields.MSGID==='BET'&&fields.IFG==='0','ACTUAL_PAID_RESPONSE');
   for(const k of ['AB','TW','BPL','LB'])need(Object.hasOwn(fields,k)&&fields[k].trim()!==''&&Number.isSafeInteger(Number(fields[k]))&&Number(fields[k])>=0,'ACTUAL_'+k+'_REQUIRED');
   need(Number(fields.BPL)===stake&&Number(fields.LB)===config.lineBet,'ACTUAL_WAGER_BINDING');
   need(!Object.keys(fields).some(k=>k==='FID'||/^FTV_|^FPM_|^FP_|^FS_/.test(k)),'ACTUAL_FEATURE_NEXT_UNMAPPED');
   if(Object.hasOwn(fields,'NFG'))need(fields.NFG.trim()!==''&&Number.isSafeInteger(Number(fields.NFG))&&Number(fields.NFG)>=0,'ACTUAL_FREE_COUNT');
   const parsed=nativeAccountConnection.acceptNativeBet(raw,httpStatus),nativeGame=parsed.nativeResult.game,nativeFree=nativeGame.freespins;need(!nativeFree.active&&nativeFree.remaining===0&&!nativeGame.wins.some(x=>x.type==='trigger')&&(nativeGame.winCount.triggers===undefined||nativeGame.winCount.triggers===0),'ACTUAL_FREE_NEXT_UNMAPPED');
   // Original FreeSpins owns its default state, but only the real native
   // readyForNextSpin -> gameEnded -> onGameEnded -> ROUND0 chain authorizes end.
   frame={raw,httpStatus};game.lastSpinData=parsed.nativeResult;game.totalWonThisSpin=parsed.actualWin;ctx.tt.Ticker.shared.lastTime=Date.now();game.readyForNextSpin();
   need(ended&&events.some(x=>x.event==='nativeState'&&x.state==='IDLE'),'ORIGINAL_CURRENT_GAME_ENDED_CALLBACK_REQUIRED');
   return Object.freeze({actualNativeRoundCallback:true,rawResponse:raw,actualBalance:parsed.actualBalance,actualWin:parsed.actualWin,noProviderEndResponseSynthesized:true,notIndependentCompletion:true,sourceDispatched:false});
  })},
  retainedRaw(){return {requests:requests.slice(),responses:responses.slice()}},
  status(){return {sealed,begun,nativeRoundEnded:ended,sourceDispatched:false,originalAGAndInitAccountStillRequired:true}},
 });
};
