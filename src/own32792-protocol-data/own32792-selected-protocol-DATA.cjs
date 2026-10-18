'use strict';
// Own32792 protocol DATA only: no renderer, HTTP actor, event bus or database.
exports.createOwn32792ProtocolDATA=function({vm,DOM,data}){
 const need=(ok,code)=>{if(!ok)throw Object.assign(new Error('OWN32792_SOURCE_DATA_HOLD_'+code),{newRequestNotSent:true,retryAllowed:false})};
 need(data?.schema==='own32792-selected-original-protocol-DATA-v1'&&vm?.Script&&DOM?.DOMParser,'DEPENDENCIES');
 const namespace={GameConfig:{isFreeSpin:false},GameWinInfoData:function(){},BGInfoData:function(){},FSInfoData:function(){}};
 const server={GLSRequest:function(encoders){this.encoders=encoders},GLSCurrencyEncoder:function(value){this._currencyMultiplier=value}};
 namespace.StakeEncoder=function(value){this._stake=value};
 const ctx=vm.createContext({sgigame:namespace,server,_super:{prototype:{execute(){}}}});
 const own=name=>new vm.Script('('+data.leaves[name].source+')').runInContext(ctx,{timeout:100});
 const init=own('init'),logic=own('logic'),end=own('end'),stakeGetter=own('stakeGetter'),money=own('money'),free=own('free'),attr=own('attr');
 namespace.StakeEncoder.prototype.parse=own('stakeXML');server.GLSCurrencyEncoder.prototype.parse=own('currencyXML');
 const int=(n,k)=>{const a=n?.attributes?.getNamedItem(k);need(a&&/^(?:0|[1-9]\d*)$/.test(a.value)&&Number.isSafeInteger(Number(a.value)),'ACTUAL_'+k);return Number(a.value)};
 const children=(n,k)=>Array.from(n?.childNodes||[]).filter(x=>x.nodeType===1&&x.nodeName===k);
 const one=(n,k)=>{const list=children(n,k);need(list.length===1,'ONE_'+k);return list[0]};
 function normalRequest(event,{wager,currencyMultiplier,historyReplay,promotion,force}){
  need(historyReplay===false&&promotion===undefined&&force===false,'EXPLICIT_NORMAL_NO_FORCE_HISTORY_PROMO');
  if(event==='Logic'){need(Number.isSafeInteger(wager)&&wager>0&&Number.isSafeInteger(currencyMultiplier)&&currencyMultiplier>0,'ACTUAL_REQUEST_VALUES')}
  const collected=[],receiver={makeInitRequest:q=>collected.push({event:'Init',q}),makeLogicRequest:q=>collected.push({event:'Logic',q}),makeEndRequest:q=>collected.push({event:'EndGame',q}),getInitResponse:()=>({platformData:{currencyMultiplier}})};
  const self={_server:receiver,_historyModel:{getIsHistoryReplay:()=>false,getNextState:()=>null},_platformModel:{promoInfo:promotion},_forceModel:{forceSet:false},_subGamesModel:{isLogicRequestSent:false},_statesModel:{getCurrentState:()=>({stateName:'OWN_NORMAL_PROTOCOL_REQUEST'})},_commonUIData:{getTotalBet:()=>wager,startPlay(){}},getStakeEncode:stakeGetter};
  namespace.PreGameStates={RECOVERY_INIT_STATE:'OWN_RECOVERY_EXCLUDED'};namespace.GameConfig.isFreeSpin=false;
  if(event==='Init')init.call(self);else if(event==='Logic')logic.call(self);else{need(event==='EndGame','OWN_EVENT');end.call(self)}
  need(collected.length===1&&collected[0].event===event,'ONE_ORIGINAL_REQUEST');
  return Object.freeze({event,encoderBody:collected[0].q.encoders.map(x=>x.parse()).join(''),encoderCount:collected[0].q.encoders.length,headerNotConstructed:true,transportAttempted:false,newProviderACK:false});
 }
 return Object.freeze({normalRequest,inspect({sessionScope,source,frame}){
  need(sessionScope&&source?.readCurrent?.(sessionScope)===frame&&source.has?.(frame)&&source.readNormalCaptureMode?.(sessionScope)==='normal-capture','CURRENT_PRIVATE_FRAME');
  need(frame?.msgId==='Logic'&&frame.httpStatus===200&&typeof frame.responsePayload==='string'&&!/<!DOCTYPE/i.test(frame.responsePayload),'ACTUAL_NORMAL_LOGIC');
  const doc=new DOM.DOMParser().parseFromString(frame.responsePayload,'text/xml'),root=doc.documentElement;
  need(root?.nodeName==='GameResponse'&&root.getAttribute('type')==='Logic'&&!doc.getElementsByTagName('Error').length&&!doc.getElementsByTagName('parsererror').length,'SUCCESSFUL_LOGIC');
  const h=one(root,'Header');need(h.getAttribute('gameID')==='20131'&&h.getAttribute('versionID')==='1_0'&&h.getAttribute('isRecovering')==='N','OWN_NORMAL_IDENTITY');
  const g=one(root,'GameResult'),winNode=one(g,'GameWinInfo'),parsed={};money.call({getAttributeFromNode:attr},doc,parsed);free.call({getAttributeFromNode:attr},doc,parsed);
  const win=int(winNode,'totalWagerWin'),wager=int(g,'stake');need(wager>0&&parsed.gameWinInfoData.totalWagerWin===win,'SOURCE_MONEY');
  const max=winNode.getAttribute('isMaxWin');need(max==='N'||max==='Y','EXPLICIT_MAX_FLAG');need(max==='N','MAX_CALLBACK_UNMAPPED');
  const spins=children(g,'ReelResults').flatMap(x=>children(x,'ReelSpin'));need(spins.length>0,'OWN_SPIN');const fs=spins[0].getAttribute('freeSpin'),bonus=spins[0].getAttribute('bonusAwarded');
  need(['Y','N'].includes(fs)&&['Y','N'].includes(bonus),'SOURCE_FLAGS');
  let route='own-ordinary-post-win-End',remaining,total,freeWin;
  if(fs==='N'&&bonus==='Y'){
   const feature=children(g,'Feature').find(x=>x.getAttribute('name')==='FreeGame');need(feature,'OWN_FREE_GAME_FEATURE');
   const bg=one(feature,'BGInfo');total=int(bg,'totalFreeSpinsTriggered');need(total>0&&parsed.freeSpinBGInfoData?.totalFreeSpinsTriggered===total,'SOURCE_INTRO_TOTAL');
   route='own-free-intro-to-native-Logic';
  }else if(fs==='Y'){
   const feature=children(g,'Feature').find(x=>x.getAttribute('name')==='FreeGame');need(feature,'OWN_FREE_GAME_FEATURE');
   const f=one(feature,'FSInfo');remaining=int(f,'remainingFreeSpins');total=int(f,'numTotalFreeSpins');freeWin=int(f,'totalFreeSpinsWin');need(parsed.freeSpinFSInfoData.totalFreeSpinsWin===freeWin,'SOURCE_FREE_WIN');need(parsed.freeSpinFSInfoData?.remainingFreeSpins===remaining&&parsed.freeSpinFSInfoData.numTotalFreeSpins===total,'SOURCE_FREE_COUNTER');
   for(const name of ['isFsRetriggered','isInRetrigger','isBonusGuarantee'])need(['Y','N'].includes(f.getAttribute(name)),'ACTUAL_'+name);
   need(!parsed.freeSpinFSInfoData.isBonusGuarantee,'GUARANTEE_CALLBACK_UNMAPPED');
   // Own CheckFSRetriggerCmd bonus branch returns through the original state graph to FREE_GAME_LOGIC_REQUEST. Wheel index is already returned presentation data, not a client choice.
   route=bonus==='Y'?'own-free-retrigger-native-Logic':remaining>0?'own-free-after-native-presentation-to-Logic':'own-free-outro-to-native-End';
  }
  return Object.freeze({sourceCumulativeWin:win,sourceWager:wager,sourceRoute:route,sourceRemaining:remaining,sourceTotal:total,sourceFreeWin:freeWin,sourceSessionID:h.getAttribute('sessionID'),nativePresentationBarriersNotExecuted:true,noSyntheticUIEvents:true,protocolRequestNotIssued:true,newProviderACK:false});
 }});
};