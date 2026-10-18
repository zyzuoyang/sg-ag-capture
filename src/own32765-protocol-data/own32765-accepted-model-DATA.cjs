'use strict';
// Native protocol fields only. Original readEnvelope/transport owns accepted frames.
exports.createOwn32765AcceptedModelDATA=function({DOM,vm,game,sessionScope,source,readEnvelopeFrame,data}) {
 const need=(v,m)=>{if(!v)throw Object.assign(new Error('own32765 accepted-model hold: '+m),{retryAllowed:false})};
 need(game.gameId==='32765'&&game.dbName==='sg_dropandlockdeepseamagic'&&game.sg.runtimeGameId===32987,'own identity');
 need(data.schema==='own32765-actual-Init-DL-model-source-DATA-v1','own source DATA');
 const ctx=vm.createContext({}),fn=s=>new vm.Script('('+s+')').runInContext(ctx,{timeout:100});
 // The selected native clear leaves use only the observable numeric value cell.
 ctx.F={Bc:class SourceValueDATA {constructor(value){this.value=value;}}};
 const acClear=fn(data.newLeaves.sharedACClear.source),fiClear=fn(data.newLeaves.ownFiClear.source),dcClear=fn(data.newLeaves.ownDCClear.source);
 ctx.F.$={Aa:{$b:{aa:{Ui:0}}}};
 const qna=fn(data.oldLeaves.ownQna.source),baseZ9=fn(data.oldLeaves.baseFreeCounters.source);
 ctx.f={prototype:{z9:baseZ9}};
 const ownZ9=fn(data.oldLeaves.ownFreeCounters.source);
 // ORa's trailing 15 visual reel cells are not request/next/money inputs.
 // Preserve its protocol-field prefix byte for byte, without creating UI models.
 const orSource=data.oldLeaves.ownORa.source,visualAt=orSource.indexOf('this.I.dc.Dl=');
 need(visualAt>0,'source ORa protocol/visual split');
 const ora=fn(orSource.slice(0,visualAt)+'}');
 need(data.modeEnum.source.includes('a.iJ=0'),'source normal mode');
 ctx.a={rr:{Xa:data.nativeConstants.modeDL,Hc:data.nativeConstants.modeFS,iJ:0},Ha:{error(){need(false,'unmapped native stake type')}}};
 ctx.l={Ui:0,zr:1,SA:2};
 const Hq=fn(data.requestLeaves.Hq.source),oi=fn(data.requestLeaves.oi.source);
 ctx.a.Aa={$b:{Hq}};ctx.g={Aa:{$b:{Hq}}};ctx.F.$.Aa.$b.oi=oi;
 const r6=fn(data.requestLeaves.childR6.source),v6=fn(data.requestLeaves.childV6.source),nla=fn(data.requestLeaves.Nla.source);
 const jla=fn(data.oldLeaves.ownJLa.source);
 const stateSource=data.stateEnum.source,clearAt=stateSource.indexOf('a.clear=');
 need(clearAt>=0&&stateSource.includes('a.Ll=0'),'source native Open/Closed enum');
 ctx.f={vg:data.nativeConstants.nativeClosed,prototype:{z9:baseZ9}};
 const clearState=fn(stateSource.slice(clearAt+'a.clear='.length));
 let I=null,service=null,nativeContext=null,current=null,initialized=false,sealed=null;
 const bindings=new WeakMap();
 const direct=(n,name,optional=false)=>{const nodes=Array.from(n?.childNodes||[]).filter(x=>x.nodeType===1&&x.nodeName===name);need(nodes.length===(optional&&nodes.length===0?0:1),'one native '+name);return nodes[0]};
 function number(n,key,required=false){const a=n?.attributes?.getNamedItem(key);if(!a){need(!required,'actual '+key);return null;}const value=parseFloat(a.value);need(Number.isFinite(value),'finite native '+key);return value;}
 function boolean(n,key){const a=n?.attributes?.getNamedItem(key);if(!a)return null;const value=a.value.toLowerCase();if(['true','1','y','yes'].includes(value))return true;if(['false','0','n','no'].includes(value))return false;need(false,'unmapped native '+key);}
 function read(frame,event){
  need(!sealed&&frame&&frame.game===game&&frame.sessionScope===sessionScope&&source.has(frame),'own original frame');
  need(source.readCurrent(sessionScope,frame.roundScope)===frame&&readEnvelopeFrame()===frame,'actual current committed readEnvelope');
  need(frame.msgId===event&&frame.httpStatus>=200&&frame.httpStatus<300,'accepted original event');
  const doc=new DOM.DOMParser().parseFromString(frame.responsePayload,'text/xml');
  need(!doc.getElementsByTagName('Error').length&&!doc.getElementsByTagName('Errors').length&&!doc.getElementsByTagName('parsererror').length,'native successful envelope');
  const root=doc.documentElement;need(root.nodeName==='GameResponse'&&root.getAttribute('type')===event,'native response type');
  const header=direct(root,'Header');need(header.getAttribute('gameID')==='20412'&&header.getAttribute('isRecovering')==='N','own non-recovery header');
  return {root,header};
 }
 return Object.freeze({
  acceptInit(frame){
   need(!initialized,'one original Init model');const {root,header}=read(frame,'Init');
   need(!direct(root,'GameResult',true)&&!direct(root,'FSInfo',true)&&!direct(root,'DLInfo',true)&&!direct(root,'BGInfo',true)&&header.getAttribute('readyForEndGame')!=='Y','unmapped native Init continuation or recovery held');
   const stakes=direct(root,'Stakes');
   const values=stakes.textContent.split('|').map(x=>parseFloat(x)),index=number(stakes,'defaultIndex',true);
   need(values.length&&values.every(x=>Number.isFinite(x)&&x>0)&&Number.isInteger(index)&&index>=0&&index<values.length,'actual Stakes/defaultIndex');
   need(values[index]===game.sg.betRaw,'original configured wager must match actual native default selection; another selection needs its original input');
   I={ac:{},Fi:{},dc:{},Fa:{},state:{}};acClear(I.ac);fiClear(I.Fi);dcClear(I.dc);clearState(I.state);
   // Native root clear initializes these before any response cash is accepted.
   I.dd=0;I.Ila=0;qna.call({I},{$$:values,aN:index});
   const account=direct(root,'AccountData'),currency=direct(account,'CurrencyInformation',true);
   let Ld,Cq;if(currency){const multiplier=direct(currency,'CurrencyMultiplier');Ld=parseFloat(multiplier.textContent);need(Number.isFinite(Ld),'actual native Init multiplier');Cq=header.getAttribute('ccyCode');}
   else {Ld=1;Cq='';} // Exact ENa absent-CurrencyInformation branch, not provider cash/AG scale.
   service={I,Et:data.actualSourceEt,$i:{Ld,Cq},si:[],gm:{},rra:{}};
   nativeContext={O:{I,Td:service},features:[]};current=frame;initialized=true;
   return Object.freeze({nativeInitApplied:true,providerCurrencyInformationPresent:!!currency,sourceRequestMultiplier:Ld,providerMultiplierClaimed:!!currency});
  },
  beforeOriginalPvRequest(){need(initialized&&!sealed,'own initialized normal request');nativeContext.features=[];nativeContext.VW=false;},
  initialLogicParameters(){
   need(initialized&&!sealed,'actual Init selection before original Logic');
   const parameters=nla.call(service,v6.call({_context:nativeContext,r6}));
   need(parameters.$m?.type===0&&parameters.$m.value===game.sg.betRaw,'source selected native wager');
   return parameters;
  },
  acceptLogic(frame){
   need(initialized&&!bindings.has(frame),'actual Init and one model update per accepted Logic');const {root,header}=read(frame,'Logic'),result=direct(root,'GameResult'),bg=direct(result,'BGInfo');
   const cash=number(bg,'totalWagerWin',true),max=boolean(bg,'isMaxWin'),dl=direct(result,'DLInfo',true),fs=direct(result,'FSInfo',true);
   const ip={EM:{xaa:cash,rg:max}};
   if(dl)ip.tH={gd:number(dl,'dlRemaining',true),lta:number(dl,'totalDropAndLocks'),CY:number(dl,'dlWinnings'),LSa:number(dl,'prevDLRemaining'),rg:number(dl,'isMaxWin')};
   if(fs)ip.k6={YU:number(fs,'freeSpinsTotal',true),WU:number(fs,'freeSpinNumber',true),oLa:number(fs,'fsWinnings'),rg:boolean(fs,'isMaxWin'),mx:number(fs,'extraSpinsAwarded'),vVa:number(fs,'spinsUsed'),uVa:number(fs,'spinsRemaining')};
   // Successful aI/SRa opens state; LW selects global MAX from BGInfo, not FSInfo.
   I.state.state=0;I.state.rg=max;acClear(I.ac);
   if(ip.k6)ownZ9.call(service,ip.k6);
   I.dd=cash;if(ip.tH)ora.call(service,ip.tH,ip.dd);
   I.ox=jla.call(service,ip);nativeContext.features=data.fixedFactoryOrder.slice();
   const request=new DOM.DOMParser().parseFromString(frame.requestPayload,'text/xml'),rh=direct(request.documentElement,'Header');
   current=frame;
   const b={frame,readEnvelopeFrame:frame,nativeContext,service,typedResponse:{ip},currentSessionID:header.getAttribute('sessionID'),requestSessionID:rh.getAttribute('sessionID')};
   bindings.set(frame,b);return b;
  },
  readOriginalBinding(){need(current&&bindings.has(current),'accepted native Logic model required');return bindings.get(current);},
  markOriginalFeatureConsumption(){need(initialized&&!sealed,'current native lifecycle');nativeContext.VW=true;},
  applyOriginalSourceEffects(effects){
   need(initialized&&!sealed&&Array.isArray(effects),'original source-selected state effects');
   const clears={ac:acClear,Fi:fiClear,dc:dcClear};
   for(const effect of effects){
    if(effect.kind==='VW'){
     need(effect.value===true&&effect.sourceSHA256===data.effectSourceOrigins.VW,'source GJ latch write');nativeContext.VW=true;
    }else{
     need(effect.kind==='source-model-clear'&&Object.hasOwn(clears,effect.target)&&effect.sourceSHA256===data.effectSourceOrigins[effect.target],'source named model clear');clears[effect.target](I[effect.target]);
    }
   }
  },
  seal(error){sealed=error||new Error('original outcome unknown');},
  protocolState(){need(initialized,'native Init required');return Object.freeze({sharedRemaining:I.ac.gd,sharedUsed:I.ac.tk,freePlayed:I.Fi.Hi,freeRemaining:I.Fi.gd,dlRemaining:I.dc.gd,dlResume:I.dc.lp,freeResume:I.Fi.lp,dlIntroCount:I.dc.hE.value,nativeState:I.state.state,globalMax:I.state.rg,requestMultiplier:service.$i.Ld,sourceCash:I.dd,VW:nativeContext.VW});}
 });
};
