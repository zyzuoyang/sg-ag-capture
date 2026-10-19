'use strict';
// Request-only projection of this game's cached FS/Hyde selectors. No SDK/UI boot.
exports.createOwn32763NativeNext=function({c,data,need}){
 const S=c.game.BaseGameStates;
 const node=(doc,name)=>doc.getElementsByTagName(name)[0];
 const integer=(n,key)=>{const raw=n?.getAttribute(key);need(typeof raw==='string'&&raw.length>0,'actual native attribute '+key);const v=parseInt(raw);need(Number.isSafeInteger(v),'native integer '+key);return v};
 const maxOnly=require('./own32763-max-only.cjs').createOwn32763MaxOnly({c,data,need});
 function decide(doc){
  const maxDecision=maxOnly.decide(doc);if(maxDecision)return maxDecision;
  const b=node(doc,'BGInfo');need(b,'actual BGInfo');const bg={totalWagerWin:integer(b,'totalWagerWin'),baseGameSpinsRemaining:integer(b,'baseGameSpinsRemaining'),isBigBet:integer(b,'isBigBet')===1,isMaxWin:integer(b,'isMaxWin')===1};
  need(bg.totalWagerWin>=0,'actual nonnegative wager win');
  need(bg.baseGameSpinsRemaining===0&&!bg.isBigBet&&!bg.isMaxWin,'unmapped max or BigBet branch retained');
  const typed={baseGameData:bg,trailData:{}};const fs=node(doc,'FSInfo'),hs=node(doc,'HSInfo'),trail=node(doc,'TrailInfo');
  if(fs){typed.fsData={freeSpinNumber:integer(fs,'freeSpinNumber'),freeSpinsTotal:integer(fs,'freeSpinsTotal')};new c.server.GLSReelResultParser().parse(doc,typed);need(typed.reelSpinData?.[0],'actual first reel for native FS predicate');if(trail)typed.trailData.symbolsInTrail=integer(trail,'symbolsInTrail')}
  if(hs){const hour=hs.getAttribute('hourGlassOutcome');need(typeof hour==='string'&&hour.length>0,'actual hourGlassOutcome');typed.hydeSpinsData={hsSpinNumber:integer(hs,'hsSpinNumber'),hourGlassOutcome:hour}}
  const owner={_server:{getLogicResponse:()=>typed}},fp=c.HandleFSLogicChoiceCmd.prototype,hp=c.HandleHydeLogicChoiceCmd.prototype;
  Object.setPrototypeOf(owner,fp);let p=S.FREESPIN_EXIT_STATE;const trace=[p];
  const set=v=>{p=v;trace.push(v)},edge=()=>{const e=data.stateEdges.filter(x=>S[x.from]===p);need(e.length===1,'one own source state edge');set(S[e[0].to])};
  // Exact branch priority. Both original finished-FS isBigWin arms select FREESPIN_OUTRO.
  if(fp.hasHydeSpinsFinished.call(owner))set(S.HYDE_EXIT_STATE);
  else if(fp.hasHydeSpins.call(owner))edge();
  else if(fp.hasFreespins.call(owner))set(S.LOGIC_GLS_STATE);
  else if(fp.hasFreespinsFinished.call(owner))set(S.FREESPIN_OUTRO);
  else edge();
  if(p===S.HYDE_EXIT_STATE){
   Object.setPrototypeOf(owner,hp);
   // Original finished-Hyde and totalWin display arms each converge to the same target.
   if(hp.hasHydespinsFinished.call(owner))set(S.HYDE_OUTRO);
   else if(hp.hasHydespins.call(owner))set(S.LOGIC_GLS_STATE);
   else edge();
  }
  // Actual HYDE_OUTRO_COMPLETE caller is HydeOutroCheckCmd, not the table default.
  if(p===S.HYDE_OUTRO){const finished=fp.hasFreespinsFinished.call(owner);if(finished)set(S.FREESPIN_OUTRO);else set(S.LOGIC_GLS_STATE)}
  if(p===S.FREESPIN_OUTRO)edge();
  if(p===S.BIG_BET_CONTINUE_STATE){const projection={getCurrentState:()=>({stateName:p}),gotoNextState:edge,doChangeStateByName:set};c.HandleBigBetCmd.prototype.execute.call({_serverModel:{getLogicResponse:()=>typed},_bigBetStakesModel:{setIsBigBet:v=>need(v===false,'actual zero remaining BigBet exit')},_statesModel:projection});c.HandleBigWinComplete.prototype.execute.call({_statesModel:projection})}
  need(p===S.LOGIC_GLS_STATE||p===S.END_GLS_STATE,'mapped own next Logic or End');
  return Object.freeze({kind:p===S.LOGIC_GLS_STATE?'continuation':'native-end-candidate',protocolPath:Object.freeze(trace),totalWagerWinRaw:bg.totalWagerWin,fs:typed.fsData?Object.freeze({...typed.fsData}):undefined,hyde:typed.hydeSpinsData?Object.freeze({...typed.hydeSpinsData}):undefined,trailActive:typed.trailData.symbolsInTrail>0,actualEndConstructed:false});
 }
 return Object.freeze({decide});
};
