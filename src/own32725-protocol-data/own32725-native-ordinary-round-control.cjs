'use strict';
const vm=require('node:vm');
exports.installNativeOrdinaryControl=function({context,game,bootstrap,requests,sourceData}){
 const need=(x,s)=>{if(!x)throw Error('MEDUSA32725_NATIVE_CONTROL_'+s)};
 const leaf=name=>{const s=sourceData.leaves.find(x=>x.name===name)?.source;need(s,'OWN_SOURCE_'+name);return s};
 const noop=()=>{},timers=new Set(),events=[],stripWrites=[],soundCalls=[];
 let ended=false,started=false,sealed=false,currentFrame=null,startBalance,wager,controlFrame=null;
 const later=(fn,ms)=>{const t=setTimeout(()=>{timers.delete(t);if(!sealed)fn()},ms);timers.add(t);return t};
 // This own presentation port preserves the original callback queue and literal positions.
 // It never supplies a response field, win amount, mode, remaining count or terminal decision.
 const choreography={calls:[],active:false,clear(){this.calls=[];return this},call(fn,args,scope,position){need(typeof fn==='function'&&Number.isFinite(position)&&position>=0,'NATIVE_SOUND_CALLBACK');this.calls.push({fn,args,scope,position});return this},pause(){return this},isActive(){return this.active},restart(){need(!this.active,'ONE_NATIVE_WILD_PRESENTATION');this.active=true;const list=this.calls.slice();list.forEach((x,i)=>later(()=>{x.fn.apply(x.scope,x.args||[]);if(i===list.length-1)this.active=false},x.position*1000));return this}};
 const strips=bootstrap.nativeCommunicator.getMarker('RST_0');need(Array.isArray(strips)&&strips.length===5&&strips.every(a=>Array.isArray(a)&&a.length),'ACTUAL_FIVE_NATIVE_REELSTRIPS');
 const reels=strips.map(a=>({reelStrip:a.slice()})),window={};strips.forEach((a,i)=>{window['reelStrip'+i]=a.slice()});
 const reelMan={reels,showSymbols:noop,stopAnims:noop,startReels:noop,animateWins:noop,animateSymbol:noop,update:noop,isStopped:()=>!!currentFrame,isReelManagerStopping:()=>false,setReelStrip:(i,a)=>{need(Array.isArray(a)&&a.length,'ACTUAL_NATIVE_REELSTRIP_BINDING');reels[i].reelStrip=a;stripWrites.push(i)}};
 const valueChanged=(name,value)=>{events.push({name,value});if(name==='ROUND'&&value===0){need(started&&currentFrame===controlFrame&&!ended,'ONE_CURRENT_ORIGINAL_ROUND_CALLBACK');ended=true}};
 Object.assign(context,{window,loaded:true,TXT_SPIN_MSG:'',TXT_PICK_BONUS:'',clearPresetField:noop,valueChanged,ssIntro:{visible:false}});
 Object.assign(game,{reelMan,wildSoundChoreo:choreography,playWildSound:false,gameState:1,roundActive:false,commsState:3,useUI3:false,autoPlay:false,historyMode:false,paylineShowDelay:0,
  freeGames:{m_bInFreeGames:false,m_RespinTimer:0},freeRounds:{inFreeRounds:false,requestOutro:false,outro:noop,updateTotalWin:noop},messageBar:{},clock:{update:noop},
  api_stopWinAnims:noop,showLines:noop,setBShowFreeSpinBg:noop,checkLowBalance:noop,startIdleMessages:noop,playSpinSound:noop,api_spinStarted:noop,api_switchReels:noop,api_runSpinningStoppedFeature:noop,
  updateHTMLMeters:noop,allowBetUI:noop,api_featureUpdate:noop,updateWinMeter:noop,updateFGAlpha:noop,updateIdleMessage:noop,playWinSounds:noop,startWinMeter:noop,api_afterAllReelsStopNoWin:noop,
  api_resetWinMeterTimer:noop,setFreeGameWonMessage:noop,api_animateWins:noop,playSound:name=>soundCalls.push(name),GDMUpdateWin:()=>need(false,'ACTUAL_NEXT_CONTROL_NOT_MAPPED'),setGamesRemainingString:()=>need(false,'ACTUAL_FREE_CONTROL_NOT_MAPPED')});
 // Source initial scene values are used only inside the mapped ordinary path. Any actual
 // free/pick/superspin route stops before these presentation-only adapters can close it.
 vm.runInContext(sourceData.stateDeclarations+'\n'+leaf('ownUpdateReelStrips')+';game.setState=('+leaf('nativeGameSetState')+');game.updateGame=('+leaf('nativeGameUpdateGame')+');game.api_spinningFeatureStopped=('+leaf('ownSpinningFeatureStopped')+');game.api_updateReelFromMsg=('+leaf('ownUpdateReelFromMsg')+');game.resetPlayWildSoundFlag=('+leaf('ownResetWildSound')+');game.api_isMetersUpdateableOnPayline=('+leaf('ownMetersUpdateable')+');',context,{timeout:1000});
 function seal(){sealed=true;for(const t of timers)clearTimeout(t);timers.clear()}
 return Object.freeze({
  begin(){need(!started&&!sealed,'ONE_INITIAL_NATIVE_ROUND');startBalance=game.account.balance;wager=game.account.getBetAmount();need(Number.isSafeInteger(startBalance)&&Number.isSafeInteger(wager)&&wager>0,'ACTUAL_NATIVE_ACCOUNT_WAGER');const n=requests.length;vm.runInContext('game.setState(SS_SPINNING);',context,{timeout:1000});need(game.roundActive&&requests.length===n+1&&events.some(x=>x.name==='ROUND'&&x.value===1),'ORIGINAL_START_AND_REQUEST');started=true;return requests.at(-1)},
  async advance(frame){
   need(started&&!sealed&&!currentFrame&&!ended&&frame.result===game.slotResult,'CURRENT_ACCEPTED_NATIVE_RESULT');const f=new URLSearchParams(frame.raw),r=frame.result;
   need(f.get('MSGID')==='BET'&&f.get('IFG')==='0'&&f.has('MUL')&&f.get('MUL').trim()!=='','ACTUAL_NONRECOVERY_PAID_PATH');
   need(!r.IFG&&r.freeGamesMode===0&&r.nextRoundFreeGamesMode===0&&r.getFreeGamesLeft()===0&&!(r.winType&(32|64))&&r.superSpinsAwarded===0&&r.specRow===-1,'ACTUAL_FREE_OR_FEATURE_NEXT_UNMAPPED');
   need(frame.actualBalance===startBalance-wager+frame.actualCumulativeWin,'ACTUAL_NATIVE_PAID_BALANCE');currentFrame=controlFrame=frame;
   try{
    vm.runInContext('game.api_updateReelFromMsg();game.setState(SS_SPINNING_STOPPED);',context,{timeout:1000});const deadline=Date.now()+6000;
    while(!ended){need(Date.now()<deadline,'FINITE_ORIGINAL_PRESENTATION_CALLBACK_BUDGET');vm.runInContext('game.updateGame(16);',context,{timeout:1000});if(!ended)await new Promise(resolve=>later(resolve,16))}
    need(!game.roundActive&&game.account.balance===frame.actualBalance,'NATIVE_END_CASH_COMMITTED');
    return Object.freeze({actualNativeRoundCallback:true,rawResponse:frame.raw,balance:frame.actualBalance,cumulativeWin:frame.actualCumulativeWin,sourceNativeState:game.gameState,sourceCallbacks:events.slice(),wildPresentationCallbacks:soundCalls.slice(),nativeReelStripWrites:stripWrites.slice(),noProviderEndResponseSynthesized:true,notIndependentCompletion:true});
   }catch(e){seal();throw e}
  },
  seal
 });
};
