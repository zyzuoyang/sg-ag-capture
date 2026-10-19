'use strict';
// Only the request state effects of this game's explicit max caller are projected.
exports.createOwn32763MaxOnly=function({c,data,need}){
 need(data.maxPrivateSchema==='own32763-max-and-Hyde-caller-v3','own max DATA');const S=c.game.BaseGameStates;
 const integer=(n,k)=>{const raw=n?.getAttribute(k);need(typeof raw==='string'&&raw.length>0,'actual max '+k);const v=parseInt(raw);need(Number.isSafeInteger(v),'native max integer '+k);return v};
 return Object.freeze({decide(doc){const bg=doc.getElementsByTagName('BGInfo')[0];need(bg,'actual max decision BGInfo');if(integer(bg,'isMaxWin')!==1)return null;
  const win=integer(bg,'totalWagerWin');need(win>=0,'actual max totalWagerWin');const typed={baseGameData:{isMaxWin:true,isBigBet:integer(bg,'isBigBet')===1}},fs=doc.getElementsByTagName('FSInfo')[0];
  if(fs)typed.fsData={freeSpinNumber:integer(fs,'freeSpinNumber')};const spin=Object.create(c.SpinTypeModel.prototype);spin._server={getLogicResponse:()=>typed};const currentFS=spin.isCurrentSpinFS(),currentBigBet=spin.isCurrentSpinBigBet();
  // Although the source BigBet max branch ends, its selected stake/request remains outside this normal private connection.
  need(!currentBigBet,'unmapped actual selected BigBet max request retained');
  const branch=currentFS?'current-FS-max':'current-base-or-Hyde-max',method=currentFS?'changeSubGame(BASE_GAME, END_GLS_STATE)':'changeStateByName(END_GLS_STATE)';
  return Object.freeze({kind:'native-end-candidate',protocolPath:Object.freeze([S.SHOW_PAYLINE_SPAGHETTI_STATE,S.MAX_WIN_STATE,S.END_GLS_STATE]),totalWagerWinRaw:win,maxSourceBranch:branch,maxSourceStateEffect:method,sourceBigBetReset:false,actualEndConstructed:false,fs:undefined,hyde:undefined,freeCounterMapping:'max selects terminal before ordinary FS/Hyde predicates; no unfinished counts manufactured'});
 }})
};
