'use strict';
const vm=require('node:vm');
exports.installNativeOrdinaryControl=function({context,game,bootstrap,requests,sourceData}){
 const need=(x,s)=>{if(!x)throw Error('MEDUSA32725_NATIVE_CONTROL_'+s)};
 const leaf=name=>{const s=sourceData.leaves.find(x=>x.name===name)?.source;need(s,'OWN_SOURCE_'+name);return s};
 const pickerSource=require('./picker-start-functions.json');const pickerLeaf=n=>{const f=pickerSource.leaves.find(x=>x.name===n)?.source;need(f,'OWN_PICKER_START_SOURCE_'+n);return f};
 const freeSource=require('./free-start-functions.json');const freeLeaf=n=>{const f=freeSource.leaves.find(x=>x.name===n)?.source;need(f,'OWN_FREE_START_SOURCE_'+n);return f};
 const noop=()=>{},timers=new Set(),events=[],stripWrites=[],soundCalls=[];
 let ended=false,started=false,sealed=false,currentFrame=null,startBalance,wager,controlFrame=null;
 const later=(fn,ms)=>{const t=setTimeout(()=>{timers.delete(t);if(!sealed)fn()},ms);timers.add(t);return t};
 // This own presentation port preserves the original callback queue and literal positions.
 // It never supplies a response field, win amount, mode, remaining count or terminal decision.
 const choreography={calls:[],active:false,clear(){this.calls=[];return this},call(fn,args,scope,position){need(typeof fn==='function'&&Number.isFinite(position)&&position>=0,'NATIVE_SOUND_CALLBACK');this.calls.push({fn,args,scope,position});return this},pause(){return this},isActive(){return this.active},restart(){need(!this.active,'ONE_NATIVE_WILD_PRESENTATION');this.active=true;const list=this.calls.slice();list.forEach((x,i)=>later(()=>{x.fn.apply(x.scope,x.args||[]);if(i===list.length-1)this.active=false},x.position*1000));return this}};
 const strips=bootstrap.nativeCommunicator.getMarker('RST_0');need(Array.isArray(strips)&&strips.length===5&&strips.every(a=>Array.isArray(a)&&a.length),'ACTUAL_FIVE_NATIVE_REELSTRIPS');
 const reels=strips.map(a=>({reelStrip:a.slice()})),window={};strips.forEach((a,i)=>{window['reelStrip'+i]=a.slice()});
 Object.assign(window,structuredClone(freeSource.alternateReelStrips));
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
 // Only the view of each original horse is ported here. No response field,
 // prize, counter, amount, request or end decision is supplied by this view.
 game.layout={symbolHeight:1};
 Object.assign(context,{Power0:{easeOut:noop},TweenMax:{to:noop},getCurrentAmbientSound:noop});
 Object.assign(game,{api_featureStart:noop,api_winLineChoreography:noop,FLASH_DELAY:250,NUM_FLASHES_PER_PAYLINE:6,NUM_FLASHES_ALL_LINE:1});
 vm.runInContext('featureController.horse=Array.from({length:featureController.horse.length},()=>({winAmount:{},start:function(){},recover:function(){}}));featureController.beginFeature=('+pickerLeaf('featureBegin')+');game.startFeature=('+pickerLeaf('nativeStartFeature')+');game.api_fastFeatureTransition=('+pickerLeaf('ownFastFeatureTransition')+');game.api_IsBonusFeatureTriggered=('+pickerLeaf('nativeBonusTriggered')+');game.api_stopReelAnims=('+pickerLeaf('nativeStopReelAnims')+');game.api_featureStart=('+pickerLeaf('nativeFeatureStart')+');game.api_beginFeature=featureController.beginFeature.bind(featureController);game.api_inFeature=function(){return featureController.started};game.GDMUpdateWin=('+pickerLeaf('ownGDMUpdateWin')+');',context,{timeout:1000});
 // Continue controls from the original intro callbacks. View objects carry
 // no result, remaining count, wager, prize or terminal decision.
 const lineView={showLine:noop,disable:noop};game.paylines=new Proxy({},{get:()=>lineView});game.api_winLineDirection=noop;game.api_symbolAnimation=noop;context.objWinLineDetails={getWinSymbolPositionsForWinLine:()=>[]};
 game.flares={stop:noop};game.snapWinMeter=noop;game.api_startSpinAction=noop;
 game.multiplierText={show:noop};game.superSpinText={show:noop};
 game.reelBorder={toRespins:{restart:noop}};game.expandedWild={x:0,start:noop};
 game.reelCrumble=Array.from({length:3},(_,i)=>({crumbleAnim:{x:i},start:noop,end:noop}));
 const nativeTimeline=function(){this.calls=[];this.call=(fn,args,scope,position)=>{this.calls.push({fn,args,scope,position});return this};this.restart=()=>{for(const x of this.calls)later(()=>x.fn.apply(x.scope,x.args||[]),x.position*1000);return this}};
 Object.assign(context,{TimelineMax:nativeTimeline,Linear:{easeNone:noop},isStandardQuality:true,bigWinTitle:{quickStop:noop},TXT_GAME_REMAINING:'',TXT_RESPIN_REMAINING:'',TXT_SUPERSPIN_REMAINING:'',TXT_GAMES_REMAINING:'',TXT_RESPINS_REMAINING:'',TXT_SUPERSPINS_REMAINING:''});
 vm.runInContext(freeLeaf('nativeFreeGames')+';game.freeGames=new CFreeGames;game.startSpin=('+freeLeaf('actualGameStartSpin')+');game.setGamesRemainingString=('+freeLeaf('ownSetGamesRemainingString')+');game.api_beforeFirstFreeGame=('+freeLeaf('ownBeforeFirstFreeGame')+');'+freeLeaf('nativeRespinIntro')+';game.reSpinsIntro=new RespinIntro;',context,{timeout:1000});
 // These methods only place/animate symbols; native timeline's original
 // game.setState callback still selects the actual stopped-free state.
 for(const key of ['animateWild','fadeWild','getOtherReels','reveal','animateOtherWilds'])game.reSpinsIntro[key]=noop;
 game.snakeCharmer={show:noop};
 const intro={visible:false};context.fgIntro=intro;
 vm.runInContext('fgIntro.startFreeGames=('+freeLeaf('freeIntroStart')+');',context,{timeout:1000});
 intro.show=()=>{intro.visible=true;later(()=>intro.startFreeGames(),0)};

 function seal(){sealed=true;for(const t of timers)clearTimeout(t);timers.clear()}
 return Object.freeze({
  begin(){need(!started&&!sealed,'ONE_INITIAL_NATIVE_ROUND');startBalance=game.account.balance;wager=game.account.getBetAmount();need(Number.isSafeInteger(startBalance)&&Number.isSafeInteger(wager)&&wager>0,'ACTUAL_NATIVE_ACCOUNT_WAGER');const n=requests.length;vm.runInContext('game.setState(SS_SPINNING);',context,{timeout:1000});need(game.roundActive&&requests.length===n+1&&events.some(x=>x.name==='ROUND'&&x.value===1),'ORIGINAL_START_AND_REQUEST');started=true;return requests.at(-1)},
  async advance(frame){
   need(started&&!sealed&&!currentFrame&&!ended&&frame.result===game.slotResult,'CURRENT_ACCEPTED_NATIVE_RESULT');const f=new URLSearchParams(frame.raw),r=frame.result;
   need(f.get('MSGID')==='BET'&&f.get('IFG')==='0'&&f.has('MUL')&&f.get('MUL').trim()!=='','ACTUAL_NONRECOVERY_PAID_PATH');
   const freeTrigger=!r.IFG&&r.freeGamesMode===0&&r.getFreeGamesLeft()>0&&r.nextRoundFreeGamesMode!==0&&!!(r.winType&32)&&!(r.winType&64);need(!r.IFG&&r.freeGamesMode===0&&((r.nextRoundFreeGamesMode===0&&r.getFreeGamesLeft()===0&&(!(r.winType&32)||(r.winType&64)))||freeTrigger)&&r.superSpinsAwarded===0&&r.specRow===-1,'ACTUAL_FREE_OR_FEATURE_NEXT_UNMAPPED');
   need(frame.actualBalance===startBalance-wager+frame.actualCumulativeWin,'ACTUAL_NATIVE_PAID_BALANCE');currentFrame=controlFrame=frame;
   try{
    const requestCount=requests.length,picker=!!(r.winType&64);
    vm.runInContext('game.api_updateReelFromMsg();game.setState(SS_SPINNING_STOPPED);',context,{timeout:1000});const deadline=Date.now()+(freeTrigger?14000:6000);
    if(freeTrigger){
     let tickAt=Date.now();
     while(requests.length===requestCount&&!ended){need(Date.now()<deadline,'FINITE_ORIGINAL_FREE_START_CALLBACK_BUDGET');const now=Date.now();context.ownFreeFrameDelta=Math.max(1,now-tickAt);tickAt=now;vm.runInContext('game.updateGame(ownFreeFrameDelta);',context,{timeout:1000});if(requests.length===requestCount&&!ended)await new Promise(resolve=>later(resolve,16))}
     need(!ended&&game.roundActive&&requests.length===requestCount+1,'ORIGINAL_FREE_REQUEST_WITHOUT_ROUND_END');
     const next=requests.at(-1),fields=new URLSearchParams(next);need(fields.get('MSGID')==='FREE_GAME','ACTUAL_OWN_FREE_GAME_WRITER');
     return Object.freeze({actualNativeRoundCallback:false,nextNativeRequest:next,rawResponse:frame.raw,balance:frame.actualBalance,cumulativeWin:frame.actualCumulativeWin,sourceCallbacks:events.slice(),noProviderEndResponseSynthesized:true});
    }
    if(picker){
     while(requests.length===requestCount&&!ended){need(Date.now()<deadline,'FINITE_ORIGINAL_PICKER_START_CALLBACK_BUDGET');vm.runInContext('game.updateGame(16);',context,{timeout:1000});if(requests.length===requestCount&&!ended)await new Promise(resolve=>later(resolve,16))}
     need(!ended&&game.roundActive&&requests.length===requestCount+1&&context.featureController.started,'ORIGINAL_PICKER_REQUEST_WITHOUT_ROUND_END');
     const next=requests.at(-1);need(next==='&MSGID=FEATURE_START&CFG=0&','ACTUAL_OWN_FEATURE_START_WRITER');
     return Object.freeze({actualNativeRoundCallback:false,nextNativeRequest:next,rawResponse:frame.raw,balance:frame.actualBalance,cumulativeWin:frame.actualCumulativeWin,sourceCallbacks:events.slice(),noProviderEndResponseSynthesized:true});
    }
    while(!ended){need(Date.now()<deadline,'FINITE_ORIGINAL_PRESENTATION_CALLBACK_BUDGET');vm.runInContext('game.updateGame(16);',context,{timeout:1000});if(!ended)await new Promise(resolve=>later(resolve,16))}
    need(!game.roundActive&&game.account.balance===frame.actualBalance,'NATIVE_END_CASH_COMMITTED');
    return Object.freeze({actualNativeRoundCallback:true,rawResponse:frame.raw,balance:frame.actualBalance,cumulativeWin:frame.actualCumulativeWin,sourceNativeState:game.gameState,sourceCallbacks:events.slice(),wildPresentationCallbacks:soundCalls.slice(),nativeReelStripWrites:stripWrites.slice(),noProviderEndResponseSynthesized:true,notIndependentCompletion:true});
   }catch(e){seal();throw e}
  },
  seal
 });
};
