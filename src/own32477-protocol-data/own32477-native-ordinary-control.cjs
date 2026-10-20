'use strict';
const vm=require('node:vm');
// Own protocol function ports only. INIT/account and the original AG adapter
// must still be connected before this can dispatch or store production data.
exports.createNativeOrdinaryControl=function({protocolData,controlData,nativeAccountConnection}){
 const need=(x,s)=>{if(!x)throw Error('CHERRY32477_NATIVE_'+s)};
 const leaves=[...protocolData.leaves,...controlData.leaves],source=name=>{const x=leaves.find(l=>l.name===name);need(x,'SOURCE_'+name);return x.source};
 const literal=controlData.actualOwnConfigLiterals;need(literal.lineBet==='8'&&literal.msBetweenSpins==='0','OWN_CONFIG');
 const requests=[],responses=[],events=[];let begun=false,sealed=false,ended=false,frame=null,stake,nextFree=false;
 const broadcast=name=>(...args)=>{events.push({event:name,args});if(name==='gameEnded')ctx.adaptor.onGameEnded(...args)};
 const wrapper={sendMsgToServer:raw=>requests.push(raw),valueChanged:(name,value)=>{events.push({event:'wrapper',name,value});if(name==='ROUND'&&value===0){need(frame&&begun&&!ended,'CURRENT_NATIVE_ROUND_CALLBACK');ended=true}}};
 const config={lineBet:8,winType:'line',msBetweenSpins:Number(literal.msBetweenSpins),defaultEventCheckTimer:Number(literal.defaultEventCheckTimer)};
 const game={autoplayController:{active:false},reelManager:{timeOfSpin:0},platform:{buyBonus:{haveUsedBuyPass:false},buttons:{}},betController:{getTotalStake:()=>stake*config.lineBet},inPromoGames:()=>false,gameState:{setState:s=>{need(s==='IDLE'||s==='SPIN','ACTUAL_NEXT_UNMAPPED');nextFree=s==='SPIN';events.push({event:'nativeState',state:s})}}};
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
  startNativeFreeRequest(){return guarded(()=>{need(begun&&nextFree&&!ended,'ACTUAL_NATIVE_FREE_NEXT_REQUIRED');const before=requests.length;ctx.adaptor.onGameStarted({stake,autoplay:false,freespin:true,gambleChoice:0,buyin:0});need(requests.length===before+1,'ONE_NATIVE_FREE_REQUEST');const raw=requests.at(-1);nativeAccountConnection.bindNativeFreeRequest(raw);frame=null;nextFree=false;return raw})},
  acceptSuccessfulOrdinaryResponse(raw,httpStatus){return guarded(()=>{
   responses.push({raw,httpStatus});need(begun&&!frame&&!ended&&typeof raw==='string'&&Number.isInteger(httpStatus)&&httpStatus>=200&&httpStatus<300,'ONE_SUCCESSFUL_CURRENT_RESPONSE');
   const fields={};for(const bit of raw.split('&')){const i=bit.indexOf('=');if(i<0)continue;const k=bit.slice(0,i),v=bit.slice(i+1);need(!Object.hasOwn(fields,k),'DUPLICATE_RESPONSE_MARKER');fields[k]=v}
   need((fields.MSGID==='BET'&&fields.IFG==='0')||(fields.MSGID==='FREE_GAME'&&(fields.IFG==='0'||fields.IFG==='1')),'ACTUAL_NATIVE_RESPONSE');
   for(const k of ['AB','TW','BPL','LB'])need(Object.hasOwn(fields,k)&&fields[k].trim()!==''&&Number.isSafeInteger(Number(fields[k]))&&Number(fields[k])>=0,'ACTUAL_'+k+'_REQUIRED');
   need(Number(fields.BPL)===stake&&Number(fields.LB)===config.lineBet,'ACTUAL_WAGER_BINDING');
   need(!Object.keys(fields).some(k=>/^FPM_|^FP_/.test(k)),'ACTUAL_PICKER_NEXT_UNMAPPED');
   if(Object.hasOwn(fields,'NFG'))need(fields.NFG.trim()!==''&&Number.isSafeInteger(Number(fields.NFG))&&Number(fields.NFG)>=0,'ACTUAL_FREE_COUNT');
   const parsed=nativeAccountConnection.acceptNativeBet(raw,httpStatus),nativeGame=parsed.nativeResult.game,nativeFree=nativeGame.freespins;need(Number.isSafeInteger(nativeFree.remaining)&&nativeFree.remaining>=0,'ACTUAL_FREE_SELECTOR');
   // Original FreeSpins owns its default state, but only the real native
   // readyForNextSpin -> gameEnded -> onGameEnded -> ROUND0 chain authorizes end.
   frame={raw,httpStatus};game.lastSpinData=parsed.nativeResult;game.totalWonThisSpin=parsed.actualWin;ctx.tt.Ticker.shared.lastTime=Date.now();game.readyForNextSpin();
   need((nextFree&&!ended)||(ended&&!nextFree),'ORIGINAL_NEXT_OR_END_CALLBACK_REQUIRED');
   return Object.freeze({actualNativeRoundCallback:ended,nativeNextFree:nextFree,nativeFree:structuredClone(nativeFree),rawResponse:raw,actualBalance:parsed.actualBalance,actualWin:parsed.actualWin,noProviderEndResponseSynthesized:true,notIndependentCompletion:true,sourceDispatched:false});
  })},
  retainedRaw(){return {requests:requests.slice(),responses:responses.slice()}},
  status(){return {sealed,begun,nativeRoundEnded:ended,nativeNextFree:nextFree,sourceDispatched:false,originalAGAndInitAccountStillRequired:true}},
 });
};
