'use strict';
const vm=require('node:vm');
// Original source leaves and the already evaluated native constants are supplied unchanged.
function createNativeResultConnection({bootstrap,leaves,cachedEvaluation}){
 const fail=s=>{throw Error('MEDUSA32725_NATIVE_RESULT_'+s)};
 if(bootstrap?.phase!=='native-bootstrap-connected')fail('ACCEPTED_INIT_AND_REELSTRIP_REQUIRED');
 const source=n=>{const v=leaves.leaves.find(x=>x.name===n)?.source;if(!v)fail('MISSING_NATIVE_'+n);return v};
 const game={account:bootstrap.account},requests=[],rawHistory=[];
 const presentationNoop=()=>{};
 Object.assign(game,{api_parseSSS:presentationNoop,api_parseCFP:presentationNoop,api_getABPM:presentationNoop,api_processMsgEnd:presentationNoop,api_processResult:presentationNoop});
 const context=vm.createContext({game,gameConfig:{way243:bootstrap.account.way243},document:{forms:{}},windowObj:{wrapperAPI:presentationNoop,sendMsgToServer:raw=>requests.push(raw)}});
 const code=cachedEvaluation.originalConstants.source+'\n'+source('SlotResult')+';\n'+source('FeatureController')+';\n'+
  'var convertToBitfield=('+cachedEvaluation.newBitfieldLeaf.source+');var overridenFunctions={processMsg:('+source('baseProcessMsg')+')};'+
  'var featureController=new FeatureController;featureController.parseFeaturePrizes=('+source('featurePrizes')+');featureController.parseFPM=('+source('featurePicksMade')+');'+
  'game.api_parseFeaturePrizes=featureController.parseFeaturePrizes.bind(featureController);game.api_parseFPM=featureController.parseFPM.bind(featureController);'+
  'game.processMsg=('+source('ownProcessMsg')+');game.api_extendSpinMsg=('+source('baseExtendSpinMsg')+');'+
  'var sendSpinMsg=('+source('sendSpinMsg')+');game.slotResult=new SlotResult;';
 vm.runInContext(code,context,{timeout:1000});
 let fault=null,initialBuilt=false,current=null,ordinaryControl=null;
 function open(){if(fault)fail('SEALED_ORIGINAL_OUTCOME');if(bootstrap.phase!=='native-bootstrap-connected')fail('BOOTSTRAP_CHANGED');}
 function guarded(fn){open();try{return fn()}catch(e){fault=e;throw e}}
 function build(){const count=requests.length;vm.runInContext('sendSpinMsg();',context,{timeout:1000});if(requests.length!==count+1)fail('ONE_ORIGINAL_NATIVE_SPIN_REQUEST');return requests.at(-1)}
 return Object.freeze({
  connectOriginalOrdinaryControl(sourceData){return guarded(()=>{if(initialBuilt||ordinaryControl)fail('CONTROL_MUST_CONNECT_BEFORE_NATIVE_ROUND');ordinaryControl=require('./own32725-native-ordinary-round-control.cjs').installNativeOrdinaryControl({context,game,bootstrap,requests,sourceData});return {originalNativeControlConnected:true,freeOrFeatureControlConnected:false}})},
  initialNativeRequest(){return guarded(()=>{if(initialBuilt||current)fail('INITIAL_ALREADY_BUILT');initialBuilt=true;return ordinaryControl?ordinaryControl.begin():build()})},
  acceptNativeSpin(raw,httpStatus){return guarded(()=>{
   rawHistory.push(Object.freeze({raw,httpStatus}));
   if(!initialBuilt||typeof raw!=='string'||!Number.isInteger(httpStatus)||httpStatus<200||httpStatus>=300)fail('SUCCESSFUL_CURRENT_NATIVE_RESPONSE_REQUIRED');
   const fields=new Map();for(const piece of raw.split('&')){const i=piece.indexOf('=');if(i<0)continue;const k=piece.slice(0,i),v=piece.slice(i+1);if(fields.has(k)&&['MSGID','B','TW','NFG','IFG','MUL'].includes(k))fail('DUPLICATE_'+k);fields.set(k,v)}
   if(!['BET','FREE_GAME'].includes(fields.get('MSGID')))fail('ACTUAL_SPIN_ACK_REQUIRED');
   for(const k of ['B','TW'])if(!fields.has(k)||fields.get(k).trim()===''||!Number.isSafeInteger(Number(fields.get(k)))||Number(fields.get(k))<0)fail('ACTUAL_FINANCIAL_'+k+'_REQUIRED');
   // Native parsing may mutate its field array; the original raw response remains untouched.
   context.currentNativeFields=raw.split('&');vm.runInContext('game.slotResult=game.processMsg(currentNativeFields.slice());',context,{timeout:1000});
   const result=game.slotResult;if(result.winAmount!==Number(fields.get('TW'))||game.account.newBalance!==Number(fields.get('B')))fail('NATIVE_MONEY_BINDING_CHANGED');
   current=Object.freeze({raw,httpStatus,result,actualBalance:game.account.newBalance,actualCumulativeWin:result.winAmount});return current;
  })},
  // This is the original request writer, not authorization to send a follow-up or finish a round.
  // The remaining native spin/feature/ROUND callbacks must drive the eventual SG connection.
  currentNativeSpinRequest(){return guarded(()=>{if(!current)fail('CURRENT_ACCEPTED_RESULT_REQUIRED');return build()})},
  currentNativeResult(){open();return current?.result},
  async completeOriginalOrdinaryFrame(){open();try{if(!ordinaryControl||!current)fail('ACTUAL_CURRENT_NATIVE_CONTROL_REQUIRED');return await ordinaryControl.advance(current)}catch(e){fault=e;ordinaryControl?.seal();throw e}},
  nativeFeatureState(){open();return context.featureController},
  retainedRaw(){return rawHistory.slice()},
  status(){return {acceptedNativeSpinResponses:rawHistory.length,sealed:!!fault,nativeRequestsConstructed:requests.length,wholeNextOrEndConnected:false,roundComplete:false,sourceDispatched:false}}
 });
}
module.exports={createNativeResultConnection};
