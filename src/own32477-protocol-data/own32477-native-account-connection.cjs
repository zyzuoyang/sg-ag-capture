'use strict';
const vm=require('node:vm');
// Own native protocol functions; the existing AG physical connection must own
// actual I/O, successful-envelope handling, raw persistence and Mongo writes.
exports.createNativeAccountConnection=function({protocolData,controlData,accountData}){
 const need=(x,s)=>{if(!x)throw Error('CHERRY32477_ACCOUNT_'+s)},all=[...protocolData.leaves,...controlData.leaves,...accountData.leaves];
 const source=n=>{const f=all.find(x=>x.name===n);need(f,'SOURCE_'+n);return f.source};
 const requests=[],responses=[],parsed=[];let state='new',sealed=false,currentRaw=null,selectedStake=null,balance=null,allowedStakes=[],pendingBet=false;
 const config={lineBet:8,numberOfWinLines:8,numReels:3,symbolsPerReel:3,winType:'line',winMechanic:'standard',...accountData.actualViewConfig};
 const platformFeatureLookup={freespins:{id:[0,1,2,3],type:'reels'},cascadeBasegame:{id:10,type:'cascade'},cascadeFreespins:{id:11,type:'cascade'},coinPickBonus:{id:20,type:'picker'},miniSlotBonus:{id:21,type:'picker'}};
 const context=vm.createContext({config,platformFeatureLookup,Wrapper:{sendMsgToServer:raw=>requests.push(raw)},debug(){},console:{error(){}},
  h:()=>name=>({broadcast:value=>{need(name==='responseReceived'&&currentRaw,'ACTUAL_RESPONSE_CALLBACK');parsed.push({raw:currentRaw,value})}}),
  l:{A:x=>typeof x},d:{A:(obj,ctor)=>need(obj instanceof ctor,'NATIVE_RECEIVER')},m:{A:(obj,k,v)=>Object.defineProperty(obj,k,{value:v,enumerable:true,configurable:true,writable:true})}});
 const parserMethods=['processInitMessage','processReelstrip','formatInitResponse','processBetMessage','getFeatureDataForID','getLanguage','shouldShowSoundButtons','getReelID','buildView','getNumberFromConfig','posWithinBounds','buildWinObject','formatGSD','formatTrail','returnArrayOfNumbers','returnArrayOfReelStops','returnCharCodes','getGameContents'];
 const code='var pe=('+source('nativeFreeSpinsModel')+'),ge=('+source('nativeCascadeModel')+');var parser={};'+parserMethods.map(n=>'parser.'+n+'=('+source(n)+');').join('')+
  'var engine={dataParser:parser,sendRequest:function(raw){Wrapper.sendMsgToServer(raw)}};'+['requestInit','sendInitRequest','gdmStringToObj','formatReelset'].map(n=>'engine.'+n+'=('+source(n)+');').join('');
 vm.runInContext(code,context,{timeout:1000});
 function guard(fn){need(!sealed,'SEALED_OUTCOME');try{return fn()}catch(e){sealed=true;throw e}}
 function fields(raw,status,msg){responses.push({raw,httpStatus:status});need(typeof raw==='string'&&Number.isInteger(status)&&status>=200&&status<300,'SUCCESSFUL_HTTP');const f={};for(const bit of raw.split('&')){const i=bit.indexOf('=');if(i<0)continue;const k=bit.slice(0,i);need(!Object.hasOwn(f,k),'DUPLICATE_MARKER');f[k]=bit.slice(i+1)}need(f.MSGID===msg,'ACTUAL_MESSAGE');need(f.ENC!=='1','ACTUAL_COMPRESSED_REELS_UNMAPPED');currentRaw=raw;return f}
 function money(f,k){need(Object.hasOwn(f,k)&&f[k].trim()!==''&&Number.isSafeInteger(Number(f[k]))&&Number(f[k])>=0,'ACTUAL_'+k+'_REQUIRED');return Number(f[k])}
 function noFeature(f){need(f.R!=='1','ACTUAL_RECOVERY_UNMAPPED');need(!Object.keys(f).some(k=>k==='FID'||/^FTV_|^FPM_|^FP_|^FS_/.test(k)),'ACTUAL_FEATURE_UNMAPPED');need(f.IFG!=='1'&&!(Object.hasOwn(f,'NFG')&&Number(f.NFG)>0),'ACTUAL_FREE_UNMAPPED')}
 function native(raw){return context.engine.gdmStringToObj(raw)}
 return Object.freeze({
  startInit(){return guard(()=>{need(state==='new','ONE_INIT');context.engine.requestInit();need(requests.length===1&&requests[0]==='&MSGID=INIT','NATIVE_INIT');state='init';return requests[0]})},
  acceptInit(raw,status){return guard(()=>{need(state==='init','INIT_ORDER');const f=fields(raw,status,'INIT');money(f,'AB');noFeature(f);need(typeof f.BD==='string'&&f.BD.endsWith('|'),'ACTUAL_BET_MENU');const menu=f.BD.split('|').slice(0,-1).map(x=>{need(x.trim()!==''&&Number.isSafeInteger(Number(x))&&Number(x)>0,'ACTUAL_BET_MENU');return Number(x)});const selected=Object.hasOwn(f,'BPL')?money(f,'BPL'):money(f,'BDD');need(menu.includes(selected),'ACTUAL_SELECTED_BET');selectedStake=selected;const p=native(raw);
   // CUR is presentation only; do not require currency text for real money.
   if(!p.CUR)p.CUR=['','','','','','',''];else for(const i of [3,5])if(p.CUR[i]===undefined)p.CUR[i]='';
   allowedStakes=menu;context.parser.processInitMessage(p);need(requests.length===2&&requests[1]==='&MSGID=REELSTRIP','NATIVE_REELSTRIP_REQUEST');state='reels';return requests[1]})},
  acceptReelstrip(raw,status){return guard(()=>{need(state==='reels','REELSTRIP_ORDER');const f=fields(raw,status,'REELSTRIP');need(typeof f.RST_0==='string','ACTUAL_REELS');native(raw);const reels=context.parser.finalGameReelsets[0];need(Array.isArray(reels)&&reels.length===config.numReels&&reels.every(r=>Array.isArray(r)&&r.length>0&&r.every(Number.isSafeInteger)),'ACTUAL_NUMERIC_REELS');context.parser.processReelstrip({});const p=parsed.at(-1);need(parsed.length===1&&p.value.message==='INIT'&&Number.isSafeInteger(p.value.player.balance)&&p.value.init.betPerLineValues[p.value.init.betPerLineIndex]===selectedStake,'NATIVE_ACCOUNT_INIT');balance=p.value.player.balance;state='ready';return{nativeInitialized:true,actualBalance:balance,selectedStake,rawRetained:true,sourceReady:false}})},
  bindNativePaidRequest(raw){return guard(()=>{need(state==='ready'&&!pendingBet&&typeof raw==='string','ONE_CURRENT_NATIVE_PAID_REQUEST');const f={};for(const bit of raw.split('&')){if(!bit)continue;const i=bit.indexOf('=');need(i>0&&!Object.hasOwn(f,bit.slice(0,i)),'NATIVE_REQUEST_FIELD');f[bit.slice(0,i)]=bit.slice(i+1)}const stake=money(f,'BPL');need(f.MSGID==='BET'&&f.AP==='false'&&f.LB==='8'&&f.GSD==='UGB:0'&&allowedStakes.includes(stake),'ACTUAL_NATIVE_PAID_INPUT');selectedStake=stake;pendingBet=true;requests.push(raw)})},
  acceptNativeBet(raw,status){return guard(()=>{need(state==='ready'&&pendingBet,'NATIVE_PAID_REQUEST_REQUIRED');const f=fields(raw,status,'BET');money(f,'AB');money(f,'TW');money(f,'BPL');money(f,'LB');noFeature(f);need(Number(f.BPL)===selectedStake&&Number(f.LB)===config.lineBet,'ACTUAL_WAGER_BINDING');const n=parsed.length;context.parser.processBetMessage(native(raw));const p=parsed.at(-1);need(parsed.length===n+1&&p.raw===raw&&p.value.message==='BET','NATIVE_CURRENT_BET_CALLBACK');need(!p.value.game.freespins.active&&p.value.game.freespins.remaining===0&&!p.value.game.cascade.active,'ACTUAL_NATIVE_NEXT_UNMAPPED');balance=p.value.player.balance;pendingBet=false;return{rawResponse:raw,nativeResult:p.value,actualBalance:balance,actualWin:Number(f.TW)}})},
  retainedRaw(){return{requests:requests.slice(),responses:responses.slice()}},
  close(){sealed=true;state='closed'},
  status(){return{state,sealed,actualBalance:balance,selectedStake,allowedStakes:allowedStakes.slice(),pendingBet,sourceReady:false,originalAGPhysicalConnectionStillRequired:true,sourceRequests:0,DBWrites:0}}
 });
};
