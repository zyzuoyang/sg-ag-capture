'use strict';
const vm=require('node:vm');
exports.installNativeOrdinaryControl=function({context,game,bootstrap,requests,sourceData,featureData}){
 const need=(x,s)=>{if(!x)throw Error('MEDUSA32725_NATIVE_CONTROL_'+s)};
 const leaf=name=>{const s=sourceData.leaves.find(x=>x.name===name)?.source;need(s,'OWN_SOURCE_'+name);return s};
 const pickerSource=require('./picker-start-functions.json');const pickerLeaf=n=>{const f=pickerSource.leaves.find(x=>x.name===n)?.source;need(f,'OWN_PICKER_START_SOURCE_'+n);return f};
 const freeSource=require('./free-start-functions.json');const freeLeaf=n=>{const f=freeSource.leaves.find(x=>x.name===n)?.source;need(f,'OWN_FREE_START_SOURCE_'+n);return f};
 const ackSource=require('./feature-start-ack-functions.json');const featureLeaf=n=>{const f=featureData.leaves.find(x=>x.name===n)?.source||ackSource.leaves.find(x=>x.name===n)?.source;need(f,'OWN_FEATURE_ACK_SOURCE_'+n);return f};
 const continuationSource=require('./continuation-ack-functions.json');const continuationLeaf=n=>{const f=continuationSource.leaves.find(x=>x.name===n)?.source;need(f,'ACTUAL_ACK_LEAF_'+n);return f};let pendingFeatureAnimation=null;
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
 // Native prize/state/request functions remain exact. Horse methods only draw the view.
 for(const horse of context.featureController.horse){horse.showPrize=noop;horse.pause=noop}
 context.TweenMax.delayedCall=(seconds,fn,args,scope)=>{need(typeof fn==='function'&&Number.isFinite(seconds)&&seconds>=0,'ACTUAL_NATIVE_FEATURE_CALLBACK');if(fn===context.featureController.onAnimComplete){need(!pendingFeatureAnimation,'ONE_NATIVE_PICK_ANIMATION_CALLBACK');const pending={fn,args,scope},before=requests.length;pendingFeatureAnimation=pending;later(()=>{if(pendingFeatureAnimation===pending&&requests.length===before){pendingFeatureAnimation=null;later(()=>fn.apply(scope,args||[]),seconds*1000)}},0);return}return later(()=>fn.apply(scope,args||[]),seconds*1000)};
 vm.runInContext('featureController.processMsg=('+featureLeaf('featureProcessMsg')+');featureController.doPick=('+featureLeaf('featureDoPick')+');featureController.checkFeatureEnd=('+featureLeaf('featureCheckEnd')+');featureController.onAnimComplete=('+featureLeaf('featureOnAnimComplete')+');',context,{timeout:1000});

 const endSource=require('./feature-end-ack-functions.json');vm.runInContext('featureController.endFeature=('+endSource.leaves.find(x=>x.name==='featureEnd').source+');',context,{timeout:1000});game.fadeOutSound=noop;game.stopSound=noop;
 const animation=()=>({pause(){return this},progress(){return this},restart:noop});
 for(const horse of context.featureController.horse)Object.assign(horse,continuationSource.horseStateConstants,{state:continuationSource.horseStateConstants.STATE_INIT,movie:{visible:false,start:noop},pickAnim:animation(),pickAgainAnim:animation(),pickMeText:{visible:false},winAllText:{visible:false},winAmount:{value:0},rollup:{updateTo:noop,isActive:()=>false},fadeOutMovie:animation()});
 context.ownContinuationLeaves=continuationSource;
 vm.runInContext('featureController.addWin=('+continuationLeaf('featureAddWin')+');featureController.finish=('+continuationLeaf('featureFinish')+');featureController.finalWinAllRollup=('+continuationLeaf('featureFinalWinAllRollup')+');for(const horse of featureController.horse){horse.start=('+continuationLeaf('horseStart')+');horse.showPrize=('+continuationLeaf('horseShowPrize')+');horse.isWinAll=('+continuationLeaf('horseIsWinAll')+');horse.finished=('+continuationLeaf('horseFinished')+');}',context,{timeout:1000});
 // Continue controls from the original intro callbacks. View objects carry
 // no result, remaining count, wager, prize or terminal decision.
 const lineView={showLine:noop,disable:noop};game.paylines=new Proxy({},{get:()=>lineView});game.api_winLineDirection=noop;game.api_symbolAnimation=noop;context.objWinLineDetails={getWinSymbolPositionsForWinLine:()=>[]};
 game.flares={stop:noop};game.snapWinMeter=noop;game.api_startSpinAction=noop;
 game.multiplierText={show:noop};game.superSpinText={show:noop};
 game.reelBorder={toRespins:{restart:noop}};game.expandedWild={x:0,start:noop};
 game.reelCrumble=Array.from({length:3},(_,i)=>({crumbleAnim:{x:i},start:noop,end:noop}));
 const nativeTimeline=function(){this.calls=[];this.call=(fn,args,scope,position)=>{this.calls.push({fn,args,scope,position});return this};this.restart=()=>{for(const x of this.calls)later(()=>x.fn.apply(x.scope,x.args||[]),x.position*1000);return this}};
 Object.assign(context,{TimelineMax:nativeTimeline,Linear:{easeNone:noop},isStandardQuality:true,bigWinTitle:{quickStop:noop,start:noop},TXT_GAME_REMAINING:'',TXT_RESPIN_REMAINING:'',TXT_SUPERSPIN_REMAINING:'',TXT_GAMES_REMAINING:'',TXT_RESPINS_REMAINING:'',TXT_SUPERSPINS_REMAINING:''});
 vm.runInContext(freeLeaf('nativeFreeGames')+';game.freeGames=new CFreeGames;game.startSpin=('+freeLeaf('actualGameStartSpin')+');game.setGamesRemainingString=('+freeLeaf('ownSetGamesRemainingString')+');game.api_beforeFirstFreeGame=('+freeLeaf('ownBeforeFirstFreeGame')+');'+freeLeaf('nativeRespinIntro')+';game.reSpinsIntro=new RespinIntro;',context,{timeout:1000});
 // These methods only place/animate symbols; native timeline's original
 // game.setState callback still selects the actual stopped-free state.
 for(const key of ['animateWild','fadeWild','getOtherReels','reveal','animateOtherWilds'])game.reSpinsIntro[key]=noop;
 game.snakeCharmer={show:noop};
 const intro={visible:false};context.fgIntro=intro;
 vm.runInContext('fgIntro.startFreeGames=('+freeLeaf('freeIntroStart')+');',context,{timeout:1000});
 intro.show=()=>{intro.visible=true;later(()=>intro.startFreeGames(),0)};
 vm.runInContext(continuationLeaf('canShowSSIntro'),context,{timeout:1000});

 function installOriginalFreeTerminalSummary(){
  const data=require('./respin-terminal-summary-functions.json');
  const original=name=>{const f=data.leaves.find(x=>x.name===name)?.source;need(typeof f==='string','ORIGINAL_RESPIN_SUMMARY_LEAF_'+name);return f};
  const cancel=token=>{if(token!==undefined){clearTimeout(token);timers.delete(token)}};
  // Only the original summary's drawing Tween/Timeline ABI is ported here.
  // Original callback pointers/scopes and literal timing arguments are retained.
  function summaryTween(target,seconds,options){
   let duration=seconds,startToken,endToken;
   const delay=options.delay||0,port={
    duration(value){if(value===undefined)return duration;need(Number.isFinite(value)&&value>=0,'ORIGINAL_SUMMARY_TWEEN_DURATION');duration=value;return port},
    updateTo(values){Object.assign(target,values);return port},
    restart(includeDelay){cancel(startToken);cancel(endToken);const wait=includeDelay?delay:0;
     if(typeof options.onStart==='function')startToken=later(()=>options.onStart.apply(options.callbackScope,options.onStartParams||[]),wait*1000);
     if(typeof options.onComplete==='function')endToken=later(()=>options.onComplete.apply(options.callbackScope,options.onCompleteParams||[]),(wait+duration)*1000);
     return port},
    pause(){cancel(startToken);cancel(endToken);startToken=endToken=undefined;return port},
    progress(){return port}
   };return port;
  }
  function SummaryPopupTimeline(options){
   let end=0,reverseToken;const labels=new Map();
   const position=value=>{
    if(value===undefined)return end;
    if(typeof value==='number'){need(Number.isFinite(value)&&value>=0,'ORIGINAL_SUMMARY_TIMELINE_POSITION');return value}
    if(typeof value==='string'&&/^\+=\d+(?:\.\d+)?$/.test(value))return end+Number(value.slice(2));
    need(typeof value==='string'&&labels.has(value),'ORIGINAL_SUMMARY_TIMELINE_LABEL');return labels.get(value);
   };
   const port={
    to(target,seconds,viewValues,at){end=Math.max(end,position(at)+seconds);return port},
    staggerTo(targets,seconds,viewValues,stagger,at){end=Math.max(end,position(at)+seconds+Math.max(0,targets.length-1)*stagger);return port},
    addLabel(name,at){const time=position(at);labels.set(name,time);end=Math.max(end,time);return port},
    set(target,viewValues,at){end=Math.max(end,position(at));return port},
    restart(){cancel(reverseToken);reverseToken=undefined;return port},
    reverse(label){cancel(reverseToken);const seconds=position(label);need(typeof options.onReverseComplete==='function','ORIGINAL_SUMMARY_REVERSE_CALLBACK');reverseToken=later(()=>options.onReverseComplete.call(options.callbackScope),seconds*1000);return port}
   };return port;
  }
  function SummaryText(text){this.text=text;this.setShadow=noop}
  function SummaryNumber(viewOptions){Object.assign(this,viewOptions);this.cfgs={',':{},'.':{}}}
  // Coordinates/labels are presentation-only. No financial or protocol field is supplied.
  game.layout.center={x:0,y:0};game.layout.designScale=1;
  game.rollupProps=structuredClone(data.originalRollupProps);
  game.flares.start=noop;game.multiplierText.hide=noop;game.reelBorder.toBaseGame={restart:noop};
  game.reelMan.updateSymbolBackgrounds=noop;game.superSpinText.hide=noop;game.api_freeSpinBgChangeAction=noop;
  if(!game.ui)game.ui={};if(!game.ui.inGameBet)game.ui.inGameBet={};
  context.ownRespinSummaryViewPorts={TextContainer:SummaryText,NumberSheet:SummaryNumber,
   TweenMax:{to:summaryTween,delayedCall:context.TweenMax.delayedCall},TimelineMax:SummaryPopupTimeline,
   Back:{easeOut:{config:()=>noop}}};
  const expression='(function(TextContainer,NumberSheet,TweenMax,TimelineMax,Back,TXT_FGS_1,TXT_FGS_2,TXT_FGS_3,TXT_FGS_4){'+original('SummaryBanner')+';'+
   'SummaryBanner.prototype.respinSummary=('+original('summaryRespin')+');SummaryBanner.prototype.show=('+original('summaryShow')+');SummaryBanner.prototype.onComplete=('+original('summaryComplete')+');SummaryBanner.prototype.hide=('+original('summaryHide')+');SummaryBanner.prototype.onEnd=('+original('summaryEnd')+');return new SummaryBanner;'+
   '})(ownRespinSummaryViewPorts.TextContainer,ownRespinSummaryViewPorts.NumberSheet,ownRespinSummaryViewPorts.TweenMax,ownRespinSummaryViewPorts.TimelineMax,ownRespinSummaryViewPorts.Back,"","","","")';
  try{context.summaryBanner=vm.runInContext(expression,context,{timeout:1000})}finally{delete context.ownRespinSummaryViewPorts}
  vm.runInContext('game.initWinRollupSound=('+original('nativeInitWinRollupSound')+');game.playWinSounds=('+original('nativePlayWinSounds')+');game.api_lastFreeGameFinish=('+original('nativeLastFreeGameFinish')+');',context,{timeout:1000});
 }

 let nativeSuperIntro;
 function installOriginalSuperSpinIntro(){
  if(nativeSuperIntro){need(context.ssIntro===nativeSuperIntro,'PINNED_ORIGINAL_SUPER_INTRO');return}
  need(context.ssIntro&&context.ssIntro.visible===false,'ORIGINAL_SUPER_INTRO_NOT_ALREADY_VISIBLE');
  const data=require('./superspin-intro-functions.json');
  const original=name=>{const f=data.leaves.find(x=>x.name===name)?.source;need(typeof f==='string','ORIGINAL_SUPER_INTRO_LEAF_'+name);return f};
  const cancel=token=>{if(token!==undefined){clearTimeout(token);timers.delete(token)}};
  // This port only advances the original SSIntro popup's display timeline.
  // Original hide/onEnd callbacks retain every native mode/state/count decision.
  function SuperIntroPopup(options){
   let end=0,scale=1,forwardToken,reverseToken;const labels=new Map();
   const position=value=>{
    if(value===undefined)return end;
    if(typeof value==='number'){need(Number.isFinite(value)&&value>=0,'ORIGINAL_SUPER_INTRO_POSITION');return value}
    if(typeof value==='string'&&/^\+=\d+(?:\.\d+)?$/.test(value))return end+Number(value.slice(2));
    need(typeof value==='string'&&labels.has(value),'ORIGINAL_SUPER_INTRO_LABEL');return labels.get(value);
   };
   const port={
    to(target,seconds,viewValues,at){end=Math.max(end,position(at)+seconds);return port},
    staggerTo(targets,seconds,viewValues,stagger,at){end=Math.max(end,position(at)+seconds+Math.max(0,targets.length-1)*stagger);return port},
    addLabel(name,at){const time=position(at);labels.set(name,time);end=Math.max(end,time);return port},
    set(target,viewValues,at){end=Math.max(end,position(at));return port},
    timeScale(value){need(Number.isFinite(value)&&value>0,'ORIGINAL_SUPER_INTRO_TIME_SCALE');scale=value;return port},
    restart(){cancel(forwardToken);cancel(reverseToken);need(typeof options.onComplete==='function','ORIGINAL_SUPER_INTRO_FORWARD_CALLBACK');forwardToken=later(()=>options.onComplete.call(options.callbackScope),end/scale*1000);return port},
    reverse(label){cancel(forwardToken);cancel(reverseToken);const seconds=position(label);need(typeof options.onReverseComplete==='function','ORIGINAL_SUPER_INTRO_REVERSE_CALLBACK');reverseToken=later(()=>options.onReverseComplete.call(options.callbackScope),seconds/scale*1000);return port}
   };return port;
  }
  function IntroText(text){this.text=text;this.setShadow=noop}
  game.layout.center={x:0,y:0};game.layout.designScale=1;
  game.flares.start=noop;game.multiplierText.update=noop;game.superSpinText.update=noop;
  game.snakeCharmer.hide=noop;game.reelBorder.toSuperSpins={restart:noop};game.reelMan.updateSymbolBackgrounds=noop;
  context.medusaShadow={start:noop};
  context.ownSuperIntroViewPorts={TextContainer:IntroText,TimelineMax:SuperIntroPopup,Back:{easeOut:{config:()=>noop}}};
  const expression='(function(TextContainer,TimelineMax,Back,TXT_SSI_1,TXT_SSI_2,TXT_SSI_3,TXT_SSI_4,TXT_SSI_5){'+original('SSIntro')+';SSIntro.prototype.show=('+original('introShow')+');SSIntro.prototype.hide=('+original('introHide')+');SSIntro.prototype.onEnd=('+original('introEnd')+');return new SSIntro;'+
   '})(ownSuperIntroViewPorts.TextContainer,ownSuperIntroViewPorts.TimelineMax,ownSuperIntroViewPorts.Back,"","","","","")';
  try{nativeSuperIntro=context.ssIntro=vm.runInContext(expression,context,{timeout:1000})}finally{delete context.ownSuperIntroViewPorts}
 }

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
  async advanceFeatureStart(frame){
   need(started&&!sealed&&!ended&&currentFrame===controlFrame&&game.roundActive&&context.featureController.started,'ACTUAL_ACTIVE_NATIVE_PICKER');
   need(Number.isInteger(frame.httpStatus)&&frame.httpStatus>=200&&frame.httpStatus<300,'SUCCESSFUL_FEATURE_START_ACK');
   const f=new URLSearchParams(frame.raw),trigger=controlFrame.result;
   const nativeFreeModes=[context.FG_BASE,context.FG_RESPIN,context.FG_SUPERSPIN];
   const actualCounter=key=>f.has(key)&&/^(0|[1-9]\d*)$/.test(f.get(key))&&Number.isSafeInteger(Number(f.get(key)));
   const ownFreeFeatureACK=f.get('IFG')==='1'&&trigger.IFG&&nativeFreeModes.includes(trigger.freeGamesMode)&&trigger.getFreeGamesLeft()>0&&actualCounter('NFG')&&Number(f.get('NFG'))===trigger.getFreeGamesLeft()&&actualCounter('CFGG')&&Number(f.get('CFGG'))===trigger.currentFreeGame;
   need(f.get('MSGID')==='FEATURE_START'&&(f.get('IFG')==='0'||ownFreeFeatureACK),'ACTUAL_FEATURE_START_ACK');
   for(const key of ['B','TW'])need(f.has(key)&&/^(0|[1-9]\d*)$/.test(f.get(key))&&Number.isSafeInteger(Number(f.get(key))),'ACTUAL_FEATURE_FINANCIAL_'+key);
   const balance=Number(f.get('B')),win=Number(f.get('TW'));need(win>=controlFrame.actualCumulativeWin&&balance===startBalance-wager+win,'NATIVE_FEATURE_START_CASH_BINDING');
   context.actualFeatureStartFields=frame.raw.split('&');
   need(vm.runInContext('featureController.processMsg("FEATURE_START",actualFeatureStartFields.slice());',context,{timeout:1000})===true,'ORIGINAL_FEATURE_ACK_CONSUMED');
   const feature=context.featureController;need(feature.pickable&&feature.prizes.length>feature.picksMade,'ACTUAL_NATIVE_PICK_AVAILABLE');
   const choice=feature.picks.findIndex(value=>value<0);need(choice>=0&&choice<feature.horse.length,'ACTUAL_UNPICKED_NATIVE_HORSE');
   const before=requests.length;context.ownNativeHorseChoice=choice;vm.runInContext('featureController.doPick(ownNativeHorseChoice);',context,{timeout:1000});
   need(requests.length===before+1&&!ended&&game.roundActive,'ONE_NATIVE_PICK_WITHOUT_END');
   const next=requests.at(-1),fields=new URLSearchParams(next);need(fields.get('MSGID')==='FEATURE_PICK','ACTUAL_NATIVE_FEATURE_PICK_WRITER');
   // This bridge stops at the next real ACK. Suspend only queued view animation;
   // no following response, prize rollup, checkEnd bit or ROUND end is invented.
   need(pendingFeatureAnimation,'ACTUAL_PICK_ANIMATION_SUSPENDED_UNTIL_ACK');
   return Object.freeze({actualNativeRoundCallback:false,nextNativeRequest:next,rawResponse:frame.raw,balance,cumulativeWin:win,sourceNativeHorseChoice:choice,noProviderEndResponseSynthesized:true});
  },

  async advanceFree(frame){
   need(started&&!sealed&&!ended&&game.roundActive&&currentFrame===controlFrame&&frame.result===game.slotResult,'CURRENT_NATIVE_FREE_ACK');
   const f=new URLSearchParams(frame.raw),r=frame.result;need(f.get('MSGID')==='FREE_GAME'&&f.get('IFG')==='1'&&f.has('MUL'),'ACTUAL_FREE_ACK_FIELDS');
   // Original parser free-mode types; no table of observed response combinations.
   // Original native callbacks still choose and emit the actual next request.
   const nativeFreeModes=[context.FG_BASE,context.FG_RESPIN,context.FG_SUPERSPIN];
   const nativeContinue=Number.isSafeInteger(r.nextRoundFreeGamesMode)&&nativeFreeModes.includes(r.nextRoundFreeGamesMode)&&r.getFreeGamesLeft()>0;
   const nativeFreeTerminal=r.nextRoundFreeGamesMode===context.FG_NONE&&r.getFreeGamesLeft()===0;
   const nativeFeaturePending=!!(r.winType&64);
   need(r.IFG&&Number.isSafeInteger(r.freeGamesMode)&&nativeFreeModes.includes(r.freeGamesMode)&&(nativeContinue||nativeFreeTerminal),'ACTUAL_BASE_FREE_NEXT_SCOPE');
   need(frame.actualBalance===startBalance-wager+frame.actualCumulativeWin,'ACTUAL_FREE_CUMULATIVE_CASH');
   if(r.freeGamesMode===context.FG_BASE&&r.nextRoundFreeGamesMode===context.FG_SUPERSPIN)installOriginalSuperSpinIntro();
   if(nativeFreeTerminal)installOriginalFreeTerminalSummary();
   currentFrame=controlFrame=frame;const before=requests.length;let tickAt=Date.now();const deadline=tickAt+14000;
   vm.runInContext('game.api_updateReelFromMsg();game.setState(SS_SPINNING_STOPPED);',context,{timeout:1000});
   const awaitingNativeEnd=()=>!ended||(nativeFreeTerminal&&context.summaryBanner.visible);
   while(requests.length===before&&awaitingNativeEnd()){need(Date.now()<deadline,'FINITE_ORIGINAL_FREE_CONTINUE_CALLBACK_BUDGET');const now=Date.now();context.ownFreeFrameDelta=Math.max(1,now-tickAt);tickAt=now;vm.runInContext('game.updateGame(ownFreeFrameDelta);',context,{timeout:1000});if(requests.length===before&&awaitingNativeEnd())await new Promise(resolve=>later(resolve,16))}
   if(nativeFreeTerminal&&!nativeFeaturePending){
    need(ended&&!game.roundActive&&requests.length===before&&!context.summaryBanner.visible&&game.account.balance===frame.actualBalance,'ORIGINAL_RESPIN_TERMINAL_ROUND_AND_CASH');
    seal();return Object.freeze({actualNativeRoundCallback:true,rawResponse:frame.raw,balance:frame.actualBalance,cumulativeWin:frame.actualCumulativeWin,sourceNativeState:game.gameState,sourceCallbacks:events.slice(),noProviderEndResponseSynthesized:true});
   }
   need(!ended&&game.roundActive&&requests.length===before+1,'ONE_NATIVE_FREE_NEXT_WITHOUT_END');const next=requests.at(-1),nextEvent=new URLSearchParams(next).get('MSGID');
   need(nativeFeaturePending?['FEATURE_START','FEATURE_PICK','FEATURE_END'].includes(nextEvent):nextEvent==='FREE_GAME','ACTUAL_FREE_CONTINUE_WRITER');
   return Object.freeze({actualNativeRoundCallback:false,nextNativeRequest:next,rawResponse:frame.raw,balance:frame.actualBalance,cumulativeWin:frame.actualCumulativeWin,noProviderEndResponseSynthesized:true});
  },
  async advanceFeaturePick(frame){
   need(started&&!sealed&&!ended&&game.roundActive&&context.featureController.started&&pendingFeatureAnimation,'CURRENT_NATIVE_PICK_ACK');
   need(Number.isInteger(frame.httpStatus)&&frame.httpStatus>=200&&frame.httpStatus<300,'SUCCESSFUL_FEATURE_PICK_ACK');
   const f=new URLSearchParams(frame.raw);need(f.get('MSGID')==='FEATURE_PICK'&&f.get('IFG')==='0','ACTUAL_FEATURE_PICK_ACK');
   for(const k of ['B','TW'])need(f.has(k)&&/^(0|[1-9]\d*)$/.test(f.get(k))&&Number.isSafeInteger(Number(f.get(k))),'ACTUAL_PICK_FINANCIAL_'+k);
   const balance=Number(f.get('B')),win=Number(f.get('TW'));need(balance===startBalance-wager+win,'ACTUAL_PICK_CUMULATIVE_CASH');
   context.actualFeaturePickFields=frame.raw.split('&');need(vm.runInContext('featureController.processMsg("FEATURE_PICK",actualFeaturePickFields.slice());',context,{timeout:1000})===true,'ORIGINAL_PICK_ACK_CONSUMED');
   const before=requests.length;context.ownPendingFeatureAnimation=pendingFeatureAnimation;pendingFeatureAnimation=null;
   vm.runInContext('ownPendingFeatureAnimation.fn.apply(ownPendingFeatureAnimation.scope,ownPendingFeatureAnimation.args||[]);',context,{timeout:1000});
   const feature=context.featureController,deadline=Date.now()+14000;
   while(requests.length===before&&!ended){
    need(Date.now()<deadline,'FINITE_NATIVE_PICK_ACK_CALLBACK_BUDGET');
    if(!feature.winAll&&feature.pickable&&feature.prizes.length>feature.picksMade){const choice=feature.picks.findIndex(v=>v<0);need(choice>=0&&choice<feature.horse.length,'ACTUAL_UNPICKED_HORSE_AFTER_ACK');context.ownNativeHorseChoice=choice;vm.runInContext('featureController.doPick(ownNativeHorseChoice);',context,{timeout:1000})}
    if(requests.length===before&&!ended)await new Promise(resolve=>later(resolve,16));
   }
   need(!ended&&game.roundActive&&requests.length===before+1,'ONE_NATIVE_PICK_NEXT_WITHOUT_END');need(game.slotResult.winAmount===win,'ORIGINAL_NATIVE_PICK_WIN_MATCHES_ACTUAL_ACK');
   const next=requests.at(-1),event=new URLSearchParams(next).get('MSGID');need(['FEATURE_PICK','FEATURE_END'].includes(event),'ACTUAL_NATIVE_PICK_NEXT_WRITER');
   return Object.freeze({actualNativeRoundCallback:false,nextNativeRequest:next,rawResponse:frame.raw,balance,cumulativeWin:win,noProviderEndResponseSynthesized:true});
  },

  async advanceFeatureEnd(frame){
   need(started&&!sealed&&!ended&&game.roundActive&&context.featureController.started&&!pendingFeatureAnimation,'CURRENT_NATIVE_FEATURE_END_ACK');
   need(Number.isInteger(frame.httpStatus)&&frame.httpStatus>=200&&frame.httpStatus<300,'SUCCESSFUL_FEATURE_END_ACK');
   const f=new URLSearchParams(frame.raw);need(f.get('MSGID')==='FEATURE_END'&&f.get('IFG')==='0','ACTUAL_FEATURE_END_ACK');
   for(const k of ['B','AB','TW'])need(f.has(k)&&/^(0|[1-9]\d*)$/.test(f.get(k))&&Number.isSafeInteger(Number(f.get(k))),'ACTUAL_FEATURE_END_FINANCIAL_'+k);
   const balance=Number(f.get('B')),win=Number(f.get('TW'));need(Number(f.get('AB'))===balance&&balance===startBalance-wager+win&&game.slotResult.winAmount===win,'ACTUAL_FEATURE_END_CASH_BINDING');
   const r=game.slotResult;need(!r.IFG&&r.freeGamesMode===context.FG_NONE&&r.nextRoundFreeGamesMode===context.FG_NONE&&r.getFreeGamesLeft()===0&&r.specRow===-1&&r.superSpinsAwarded===0,'ACTUAL_BASE_FEATURE_END_SCOPE');
   context.actualFeatureEndFields=frame.raw.split('&');const before=requests.length;
   need(vm.runInContext('featureController.processMsg("FEATURE_END",actualFeatureEndFields.slice());',context,{timeout:1000})===true,'ORIGINAL_FEATURE_END_ACK_CONSUMED');
   need(!context.featureController.started&&game.account.newBalance===balance,'ORIGINAL_FEATURE_END_NATIVE_BALANCE');
   const deadline=Date.now()+6000;
   while(!ended){need(Date.now()<deadline,'FINITE_ORIGINAL_FEATURE_END_CALLBACK_BUDGET');vm.runInContext('game.updateGame(16);',context,{timeout:1000});if(!ended)await new Promise(resolve=>later(resolve,16))}
   need(requests.length===before&&!game.roundActive&&game.account.balance===balance,'ORIGINAL_FEATURE_END_ROUND_AND_CASH');
   seal();return Object.freeze({actualNativeRoundCallback:true,rawResponse:frame.raw,balance,cumulativeWin:win,sourceNativeState:game.gameState,sourceCallbacks:events.slice(),noProviderEndResponseSynthesized:true});
  },
  seal
 });
};
