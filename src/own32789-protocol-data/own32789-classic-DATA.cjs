'use strict';
const {createOwn32789AutomaticFreeDATA}=require('./own32789-automatic-free-DATA.cjs');
const {createOwn32789PickDATA}=require('./own32789-pick-DATA.cjs');
const {createOwn32789NativeMAXDATA}=require('./own32789-native-MAX-DATA.cjs');
'use strict';
// Only own request DATA and local RandomWild completion. No display engine or HTTP actor.
exports.createOwn32789ClassicDATA=function({DOM,vm,data,sharedSource,game,need}){
 const automaticFree=createOwn32789AutomaticFreeDATA({DOM,vm,data,game,need});const automaticPick=createOwn32789PickDATA({DOM,vm,data,game,need});const nativeMAX=createOwn32789NativeMAXDATA({DOM,vm,data,game,need});let networkMode="base";const shared={},noop=()=>{};let platform,emits=[],state=0;
 const ctx=vm.createContext({document:{implementation:DOM.implementation},XMLSerializer:DOM.XMLSerializer,
  define:(deps,f)=>f(()=>{throw Error('Own DATA must not construct network dependencies');},shared,{}, {}, {}),luckytree:{Config:{}},console:{log:noop}});
 vm.runInContext(sharedSource,ctx,{timeout:1000});ctx.glscomms=shared;
 const leaf=n=>vm.runInContext('('+data.newOwnSourceLeaves[n].source+')',ctx,{timeout:1000});
 const selector=leaf('stateSelector'),spin=leaf('spinComplete'),bangup=leaf('bangupComplete'),end=leaf('realEndCaller'),currency=leaf('parseCurrentCurrency'),payload=leaf('wagerSerializer'),bonusSelector=leaf('actualBonusSelector'),viewEnd=leaf('randomViewComplete');
 const logic={gameState:0,historyData:null,spinCount:0,customFeatureInfo:null};ctx._this=logic;
 const randomComplete=leaf('randomCompleteCallback');
 const ui={historyData:null,inFreeSpins:false,isRealMoney:false,spinButtonEnableTracker:{dependencyMet:noop},logic};ctx.UIController={EventBangupComplete:'own local completion'};
 const display={start:()=>bangup.call(ui)};
 Object.assign(logic,{treeAnimationController:{setCanLoop:noop},canPlayTreeAnimation:noop,audioController:{playTreeMoveSnd:noop},slot:{setGaffingEnabled:noop,getWinDisplayController:()=>display},uiController:{showSkipButton:noop},glsRequestor:{makeEndRequest:()=>emits.push('EndGame')},sendEndGame:()=>end.call(logic),handleSpinComplete:()=>spin.call(logic),getRandomWildFeatureInfo:leaf('randomFeatureModel')});
 const doc=t=>new DOM.DOMParser().parseFromString(t,'text/xml'),tags=(d,n)=>Array.from(d.getElementsByTagName(n)),children=(d,n)=>Array.from(d.childNodes||[]).filter(x=>x.nodeType===1&&(!n||x.nodeName===n));
 const money=(node,name)=>{const a=node?.attributes?.getNamedItem(name);need(a&&/^\d+$/.test(a.value)&&Number.isSafeInteger(Number(a.value)),'actual '+name);return Number(a.value)};
 return Object.freeze({
  wire(event,sid,selection){need(event==='Init'||platform,'actual own initialized request DATA');const metadata={isRealMoney:()=>game.sg.header.freePlay!=='Y',getGameCode:()=>game.sg.header.gameCodeRGI,getLocale:()=>game.sg.header.lang},session={getContextID:()=>game.sg.header.affiliate,getPlayerID:()=>game.sg.header.userID};const h=new shared.GLSRequestHeader(metadata,session,{id:game.sg.header.gameID,version:game.sg.header.versionID},sid,event==='Init'?null:platform),q=new shared.GLSRequestData(event,h);if(event==='Logic'){const m=platform.getCurrencyMultiplier();need(Number.isSafeInteger(m)&&m>0,'own outgoing multiplier');q.addCustomPayload(new shared.CurrencyMultiplierPayload(m));q.addCustomPayload({toXML:()=>payload.call({totalStake:game.sg.betRaw})});if(selection){automaticPick.choose(selection);q.addCustomPayload({toXML:()=>automaticPick.payload(selection)})}}return q.toXMLString()},
  init(text){const d=doc(text);platform=currency.call({},d);need(!platform.isRecovering,'own nonrecovery Init');const menus=tags(d,'Stakes');need(menus.length===1&&menus[0].textContent.split('|').map(Number).includes(game.sg.betRaw),'own selected actual stake menu');return platform},
  begin(){need(!emits.length,'prior own local request consumed');automaticFree.begin();automaticPick.begin();networkMode='base';state=logic.gameState=0},
  next(text){const maxDoc=doc(text),maxResult=tags(maxDoc,'GameResult');need(maxResult.length===1,'one actual own MAX selector result');const maxBase=children(maxResult[0],'BaseGame');need(maxBase.length===1,'one actual own MAX selector BaseGame');const nativeMAXFlag=maxBase[0].getAttribute('isMaxWin');need(['Y','N'].includes(nativeMAXFlag),'actual own MAX selector flag');if(nativeMAXFlag==='Y'&&networkMode==='base'){const primary=tags(maxDoc,'Feature')[0]?.getAttribute('index');if(primary==='1'){const f=automaticFree.next(text);need(f,'native MAX Free entry must not disappear');networkMode='free';return f;}if(primary!=='2')return nativeMAX.baseNext(text);}if(networkMode!=='free'){const p=automaticPick.next(text);if(p){networkMode="pick";return p}}const automatic=automaticFree.next(text);if(automatic){need(networkMode!=="pick","own Pick cannot change to Free");networkMode="free";return automatic;}const d=doc(text),results=tags(d,'GameResult');need(results.length===1,'one actual own result');const g=results[0],base=children(g,'BaseGame'),features=children(g,'Feature');need(base.length===1&&money(g,'stake')===game.sg.betRaw,'own actual wager');
   // Free/Pick/recovery are genuine other network modes and remain held.
   need(!children(g,'BaseGameRecoveryInfo').length&&features.length<=1&&features.every(x=>x.getAttribute('index')==='3'&&x.getAttribute('name')==='RandomWild'),'own unqualified network mode held');
   need(base[0].getAttribute('isMaxWin')==='N','own max mode held');const win=base[0].attributes.getNamedItem('totalWagerWin')?money(base[0],'totalWagerWin'):money(g,'totalWin');
   const reels=children(g,'ReelResults');need(reels.length===1,'own actual reel response');let bonus;
   const gameData={setStopPositions:noop,setIsBonusTriggered:v=>bonus=v,isBonusTriggered:()=>{need(typeof bonus==='boolean','actual own bonus selector');return bonus},getCustomData:()=>({getIsMaxWin:()=>false})};
   bonusSelector.call({populatePaylineWin:noop,populateAnywayWin:noop,populateScatterWin:noop},gameData,reels[0]);
   need(!bonus||features.length===1,'unmapped actual bonus held');logic.customFeatureInfo=features.length?{featureindex:features[0].getAttribute('index')}:null;
   logic.totalWin=win;logic.gameData=gameData;logic.gameState=selector.call(logic,state,gameData);emits=[];
   spin.call(logic);
   if(features.length&&logic.gameState===0&&emits.length===0)viewEnd.call({destroyAllWilds:noop,signal:{onComplete:()=>randomComplete()}});
   need(logic.gameState===0&&emits.length===1&&emits[0]==='EndGame','one own actual End request callback');emits=[];state=0;
   return Object.freeze({event:'EndGame',action:'PLAY',sourceCumulativeWin:win,sourceState:0})},
  acceptedEnd(){automaticFree.acceptedEnd();automaticPick.acceptedEnd();networkMode='base';need(state===0,'own actual terminal state')}
 });
};
