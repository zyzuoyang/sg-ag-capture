'use strict';
const {createOwn32765AcceptedModelDATA}=require('./own32765-accepted-model-DATA.cjs');
const {createOwn32765OriginalOncePhase}=require('./own32765-original-once-phase.cjs');
const {createOwn32765ParentContinuation}=require('./own32765-Free-Hc-Ch-parent-O5-DATA-v5.cjs');
exports.createOwn32765OriginalSGConnection=function({DOM,vm,game,sessionScope,readOriginalState,readOriginalHeaderPayload,modelData,parentData,bindingData}) {
 const need=(v,m)=>{if(!v)throw Object.assign(new Error('AG integrity: own32765 '+m),{own32765IntegrityHold:true,retryAllowed:false})};
 need(game.gameId==='32765'&&game.dbName==='sg_dropandlockdeepseamagic'&&game.sg.runtimeGameId===32987,'own original identity');
 need(game.sg.own32765ProtocolDATA?.contract==='own32765-original-DL-parent-private-v1','own protocol DATA');
 need(!game.sg.unknownFreeSessionRecovery&&!game.sg.ownMatchedPaidContract,'no reset or replay authority');
 const rawByStep=new WeakMap(),frames=new WeakSet();
 let phase='new',pending=null,inflight=null,current=null,envelopeFrame=null,init=null,round=null,parent=null,ordinal=0,logicOrdinal=0,mapped=null,mappingTaken=false,lastResult=null,nextAction=null,sealed=null,book;
 function original(){const s=readOriginalState();need(!sealed&&s&&s.game===game&&s.sessionScope===sessionScope&&!s.closed,'current original session');return s;}
 const source={has:f=>frames.has(f),readCurrent:(s,r)=>s===sessionScope&&r===current?.roundScope?current:undefined,readRequestPhase:f=>book.readRequestPhase(f)};
 const model=createOwn32765AcceptedModelDATA({DOM,vm,game,sessionScope,source,readEnvelopeFrame:()=>envelopeFrame,data:modelData});
 function selectCurrent(frame){
  need(parent&&round&&frame.roundScope===round,'own current original round');
  const descriptor=parent.selectCurrentRound(parent.bindCurrent(frame));
  if(descriptor?.kind==='request')model.applyOriginalSourceEffects(descriptor.sourceEffects);
  need(descriptor?.kind==='request',descriptor?.reason||'native continuation not selected');
  need(['FREE_SPIN','PLAY'].includes(descriptor.action),'native original action');mapped=descriptor;return descriptor;
 }
 book=createOwn32765OriginalOncePhase({game,sessionScope,source,readEnvelopeFrame:()=>envelopeFrame,
  selectInitial:()=>({kind:'request',event:'Logic',action:'SPIN',parameters:model.initialLogicParameters()}),selectCurrent});
 const parse=raw=>{need(typeof raw==='string'&&!/<!DOCTYPE/i.test(raw),'raw original XML');return new DOM.DOMParser().parseFromString(raw,'text/xml');};
 function header(sid){
  const d=parse(readOriginalHeaderPayload()),root=d.documentElement,headers=Array.from(root.childNodes||[]).filter(n=>n.nodeType===1&&n.nodeName==='Header');
  need(root.nodeName==='GameRequest'&&root.getAttribute('type')==='Init'&&headers.length===1,'original SG Header serialization');
  const h=headers[0];need(h.getAttribute('gameID')==='20412'&&h.getAttribute('sessionID')===sid,'actual own native request SID');
  return new DOM.XMLSerializer().serializeToString(h);
 }
 function wire(event,parameters,sid){
  const h=header(sid);if(event==='Init'||event==='EndGame')return '<GameRequest type="'+event+'">'+h+'</GameRequest>';
  need(event==='Logic'&&parameters.$m?.type===0&&Number.isSafeInteger(parameters.$m.value)&&parameters.$m.value===game.sg.betRaw,'actual native total stake');
  need(parameters.oN==null&&parameters.gh==null,'unmapped force/debug inputs');
  const a=parameters.Ld==null?'':'<AccountData><CurrencyMultiplier>'+String(parameters.Ld)+'</CurrencyMultiplier></AccountData>';
  return '<GameRequest type="Logic">'+h+a+'<Stake total="'+String(parameters.$m.value)+'"/></GameRequest>';
 }
 function issue(prepared){
  const s=original(),parameters=prepared.event==='Logic'?{...game.sg.stake}:{};
  pending=Object.freeze({event:prepared.event,parameters:Object.freeze(parameters),nativeParameters:prepared.parameters,ticket:prepared.ticket,
   requestPayload:wire(prepared.event,prepared.parameters,s.sessionID),requestHeaders:Object.freeze([Object.freeze(['Content-Type','text/xml'])]),
   sessionScope,roundScope:round,requestSessionID:s.sessionID,originalResponseFrame:current});
  return pending;
 }
 return Object.freeze({
  consume(event,parameters,sid){
   const s=original();if(phase==='new'){need(event==='Init'&&Object.keys(parameters).length===0,'one original Init');pending=Object.freeze({event:'Init',parameters:Object.freeze({}),requestPayload:wire('Init',{},sid),sessionScope,roundScope:null,requestSessionID:sid});}
   need(!inflight&&pending&&pending.event===event&&JSON.stringify(pending.parameters)===JSON.stringify(parameters)&&pending.requestSessionID===sid&&s.sessionID===sid,'single issued original request');
   if(event==='EndGame')need(phase==='terminal-ready'&&mappingTaken&&lastResult,'original result committed before actual End');
   if(event!=='Init'){book.consume(pending.ticket,event,pending.nativeParameters);if(event==='Logic')model.beforeOriginalPvRequest();book.bindOriginalSerializedRequest(pending.ticket,pending.requestPayload);}
   inflight=pending;pending=null;phase='inflight';return inflight;
  },
  rememberOriginalWire(record){
   original();need(record.dispatch===inflight&&record.step?.msgId===inflight.event&&record.step.requestPayload===inflight.requestPayload&&record.requestSessionID===inflight.requestSessionID&&record.httpStatus>=200&&record.httpStatus<300&&!rawByStep.has(record.step),'accepted original dispatch binding');rawByStep.set(record.step,record);
  },
  commitAfterOriginalReadEnvelope(step,envelope){
   const s=original(),raw=rawByStep.get(step);need(raw&&raw.dispatch===inflight&&step.msgId===envelope.type,'one accepted original raw step');
   const d=parse(step.responsePayload),h=d.getElementsByTagName('Header');need(d.documentElement.nodeName==='GameResponse'&&d.documentElement.getAttribute('type')===step.msgId&&h.length===1&&h[0].getAttribute('gameID')==='20412'&&h[0].getAttribute('sessionID')===s.sessionID&&h[0].getAttribute('isRecovering')==='N','original accepted non-recovery cursor');
   current=Object.freeze({msgId:step.msgId,httpStatus:raw.httpStatus,requestPayload:step.requestPayload,responsePayload:step.responsePayload,game,sessionScope,roundScope:inflight.roundScope,step});frames.add(current);envelopeFrame=current;
   if(step.msgId==='Init'){need(!init,'one native Init');model.acceptInit(current);init=current;phase='idle';nextAction='SPIN';}
   else if(step.msgId==='Logic'){
    need(round&&inflight.roundScope===round,'same original round');book.commitAccepted(inflight.ticket,current);model.acceptLogic(current);
    logicOrdinal++;mappingTaken=false;lastResult=null;const prepared=book.prepareNext(current,round);nextAction=mapped.action;phase=prepared.event==='Logic'?'followup-ready':'terminal-ready';issue(prepared);
   }else{
    need(step.msgId==='EndGame'&&round&&nextAction==='PLAY'&&!envelope.GameResult&&!d.getElementsByTagName('GameResult').length,'actual original End response');book.commitAccepted(inflight.ticket,current);nextAction='SPIN';phase='idle';round=null;parent=null;
   }
   inflight=null;rawByStep.delete(step);
  },
  initial(){
   const s=original();need(init&&phase==='idle'&&!pending&&!inflight&&s.action==='SPIN'&&Number.isSafeInteger(s.balanceRaw),'original paid issue from accepted idle');
   round=Object.freeze({sessionScope,roundOrdinal:++ordinal,startBalanceRaw:s.balanceRaw});
   parent=createOwn32765ParentContinuation({DOM,vm,game,sessionScope,roundScope:round,source,readOriginalBinding:()=>model.readOriginalBinding(),data:parentData,bindingData});
   logicOrdinal=0;mapped=null;mappingTaken=false;lastResult=null;phase='paid-ready';const q=issue(book.prepareInitial(current,round));return {event:q.event,parameters:q.parameters};
  },
  exact(action){original();need(action===nextAction&&pending&&['FREE_SPIN','PLAY'].includes(action),'current original native next');return {event:pending.event,parameters:pending.parameters};},
  pickProtocol(action){original();need(action===nextAction,'current original automatic native action');return undefined;},
  currentOriginalMapping(g,first){
   original();need(current?.msgId==='Logic'&&mapped&&!mappingTaken&&first===(logicOrdinal===1)&&g&&Number(g.stake)===game.sg.betRaw&&g.BGInfo&&g.BGInfo.totalWagerWin!==''&&g.BGInfo.totalWagerWin!=null&&Number(g.BGInfo.totalWagerWin)===mapped.sourceCumulativeWin,'one original raw-money mapping');
   mappingTaken=true;return {win:mapped.sourceCumulativeWin,free:undefined,next:nextAction,sourceProtocolKind:'own32765-source-native-continuation'};
  },
  finishOriginalResult(event,result){const s=original();need(s.action===nextAction&&result?.NextActionInfo?.nextAction===nextAction&&current?.msgId===event,'original result agrees with native next');if(event==='Logic')need(mappingTaken&&result.money?.totalWinRaw===mapped.sourceCumulativeWin,'original raw source money preserved');lastResult=result;return result;},
  seal(error){if(!sealed)sealed=error||new Error('original own32765 outcome retained');if(inflight?.ticket)book.sealUnknown(inflight.ticket,sealed);model.seal(sealed);phase='sealed';},
  status(){return {phase,roundOrdinal:ordinal,sealed:!!sealed,pendingRetained:!!pending,inflightRetained:!!inflight,acceptedInitRetained:!!init,retryAllowed:false,sourceRequestsByConnection:0};}
 });
};
