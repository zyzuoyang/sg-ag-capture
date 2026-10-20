'use strict';
// Own normal-mode DATA only. SG sends requests; original AG owns rounds/money/DB.
const assert = require('node:assert/strict');
const STAKE = Object.freeze({total:'16',gameMode:'0'});
const CHOICE = Object.freeze({__sgJinjiNormalChoice:'0'});
const has = (x,k) => Object.prototype.hasOwnProperty.call(x,k);
function hold(ok,label) { assert(ok,'AG integrity: own32778 '+label); }
function uint(x,label) {
  hold(typeof x==='string' && /^(?:0|[1-9]\d*)$/.test(x),label+' missing/invalid');
  const n=Number(x);hold(Number.isSafeInteger(n),label+' unsafe');return n;
}
function obj(x,label) { hold(x && typeof x==='object' && !Array.isArray(x),label);return x; }
function decision(g) {
  if(g.DecisionInfo===undefined)return undefined;
  const d=obj(g.DecisionInfo,'DecisionInfo');
  // Display additions do not change the source's explicit control fields.
  hold(has(d,'pickType') || has(d,'picksAwarded')&&has(d,'picksUsed'),'missing DecisionInfo control');
  let pending;
  if(has(d,'picksAwarded')||has(d,'picksUsed')) {
    const awarded=uint(d.picksAwarded,'picksAwarded'),used=uint(d.picksUsed,'picksUsed');
    hold(used<=awarded,'DecisionInfo order');pending=used<awarded;
    if(pending)hold(awarded===1&&used===0,'unmapped multiple decision');
  }
  if(has(d,'pickType'))hold(uint(d.pickType,'pickType')===0,'unmapped TopUp/other actual choice');
  return {raw:d,pending};
}
function scopeAndCash(g,choiceACK=false,paidJackpot=false,paidGoldDisplay=false) {
  obj(g,'GameResult');
  // Preserve unknown display DATA. Only explicit new control branches are held.
  for(const k of ['Feature','PickerInfo','GambleInfo','NextActionInfo'])
    hold(g[k]===undefined,'unmapped control branch '+k);
  if(g.ReelResults!==undefined) {
    const reels=obj(g.ReelResults,'actual ReelResults').ReelSpin;
    hold(reels && (Array.isArray(reels)?reels.length>0:typeof reels==='object'),'actual ReelSpin required');
  } else hold(choiceACK,'actual ReelResults');
  if(g.stake!==undefined)hold(uint(g.stake,'stake')===16,'changed stake');
  const bg=obj(g.BGInfo,'BGInfo');
  hold(bg.gameMode==='0','actual normal mode required');
  hold(bg.isMaxWin==='0','unmapped maximum-win result');
  if(has(bg,'goldChanceAwarded'))hold(bg.goldChanceAwarded==='0'||paidGoldDisplay&&bg.goldChanceAwarded==='1','unmapped goldChanceAwarded');
  if(has(bg,'jackpotAwarded'))hold(bg.jackpotAwarded===(paidJackpot?'1':'0'),'unmapped jackpotAwarded');
  if(has(bg,'baseGameSpinsRemaining'))hold(uint(bg.baseGameSpinsRemaining,'base remaining')===0,'unmapped base continuation');
  if(g.FSInfo!==undefined) {
    obj(g.FSInfo,'FSInfo');
    if(has(g.FSInfo,'isMaxWin'))hold(g.FSInfo.isMaxWin==='0','unmapped free maximum-win result');
  }
  return uint(bg.totalWagerWin,'actual totalWagerWin');
}
function validatePaidJackpot0(g,win) {
  // Cached own LL handles sF as a local jackpot display; K2 still selects End
  // when no actual free budget or pending decision exists. BG cash already includes it.
  hold(g.BGInfo.jackpotAwarded==='1'&&g.FSInfo===undefined&&g.DecisionInfo===undefined,'actual paid jackpot scope');
  const jp=obj(g.JackpotInfo,'actual JackpotInfo');
  hold(uint(jp.jackpotType,'actual jackpotType')===0,'unmapped jackpot type');
  const jackpot=uint(jp.jackpotWinnings,'actual jackpotWinnings');
  const spins=g.ReelResults.ReelSpin,rows=Array.isArray(spins)?spins:[spins];
  hold(g.ReelResults.numSpins==='1'&&rows.length===1,'actual paid jackpot reel count');
  const spin=obj(rows[0],'actual paid jackpot spin');
  hold(spin.spinIndex==='0'&&spin.reelsetIndex==='0'&&spin.freeSpin==='N'&&spin.bonusAwarded==='N'&&
    spin.scatterWinCount==='0','unmapped paid jackpot spin');
  const wins=spin.AnywayWin===undefined?[]:Array.isArray(spin.AnywayWin)?spin.AnywayWin:[spin.AnywayWin];
  hold(wins.length===uint(spin.anywayWins,'actual ways count'),'actual paid jackpot ways');
  const indices=new Set();let line=0;
  for(const w of wins){obj(w,'actual way');const index=uint(w.winIndex,'actual way index');hold(!indices.has(index),'duplicate way');
    indices.add(index);hold(uint(w.ways,'actual ways')>0,'actual positive ways');uint(w.awardIndex,'actual award');line+=uint(w.winVal,'actual line win');}
  hold(Number.isSafeInteger(line)&&line===uint(spin.totalSpinWin,'actual spin win')&&
    line+jackpot===uint(g.totalWin,'actual current win')&&line+jackpot===uint(g.BGInfo.bgWinnings,'actual base win')&&
    line+jackpot===win,'actual jackpot cash components');
}
function sourceLocalUsed(f) {
  // Cached SG.Oc.Sb.LL clears rb before k4. k4 chooses Vfa, else VPa,
  // else its LOCAL zero. No local used++ is present in this source path.
  // These optional aliases have exact cached XML decorators; never force them.
  if(has(f,'freeSpinNumber'))return uint(f.freeSpinNumber,'freeSpinNumber');
  if(has(f,'spinsUsed'))return uint(f.spinsUsed,'spinsUsed');
  return 0; // native local model reset, never written into raw wire DATA
}
function create(game) {
  hold(game.gameId==='32778' && game.dbName==='sg_jinjibaoxiendlesstreasure' &&
    game.sg?.runtimeGameId===33000 && game.sg.header?.gameID==='20322' &&
    game.sg.jinjiEndlessContract==='jinji-endless-own-scatter-bank-v1' &&
    game.sg.betRaw===16 && game.sg.logicPaylineCount==='1','own game binding');
  assert.deepEqual(game.sg.stake,STAKE,'AG integrity: own32778 original stake binding');
  let phase='base-ready',free,selectedType,sealed=false;
  function live(){hold(!sealed,'session sealed; no replay');}
  function mapped(win,next){return {win,free:free?{...free,accumulativeWin:win/100}:undefined,next};}
  function logicPayload(header,parameters,action) {
    live();hold(typeof header==='string' && header.startsWith('<Header'),'original SG Header');
    let choice='';
    if(action==='SPIN') {
      hold(phase==='base-ready','paid request order');assert.deepEqual(parameters,STAKE,'AG integrity: own32778 paid parameters');phase='await-base';
    } else if(action==='FREE_SPIN') {
      hold(phase==='free-ready' && free && free.freeSpinsRemaining>0,'free request order');
      assert.deepEqual(parameters,STAKE,'AG integrity: own32778 free parameters');phase='await-free';
    } else {
      hold(action==='PICK' && phase==='choice-ready','choice request order');
      assert.deepEqual(parameters,CHOICE,'AG integrity: own32778 only explicit native normal0');
      selectedType=0;phase='await-choice';choice='<FreeSpinChoice type="0"/>';
    }
    // Retains the successful own paid wire and adds only the actual native choice.
    return '<GameRequest type="Logic"><AccountData><CurrencyMultiplier>1</CurrencyMultiplier></AccountData>'+header+
      '<Stake total="16" gameMode="0"/><PaylineCount count="1"/>'+choice+'</GameRequest>';
  }
  function accept(g,first,ordinaryWin) {
    live();hold(['await-base','await-choice','await-free'].includes(phase),'response without consumed request');
    hold(first===(phase==='await-base'),'original round association');
    const d=decision(g),choiceACK=phase==='await-choice',paidJackpot=phase==='await-base'&&g.JackpotInfo!==undefined;
    // Native Asa is local symbol presentation; K2 still ends a paid result
    // without actual free/decision/JP control. Original paid cash validation stays required.
    const paidGoldDisplay=phase==='await-base'&&!paidJackpot&&g.FSInfo===undefined&&d===undefined;
    const win=scopeAndCash(g,choiceACK,paidJackpot,paidGoldDisplay);
    if(phase==='await-choice') {
      // Actual ACK type is mandatory. No missing pickType -> selected0 fallback.
      hold(d && has(d.raw,'pickType') && uint(d.raw.pickType,'actual ACK pickType')===selectedType,'actual choice ACK mismatch/missing');
      const f=obj(g.FSInfo,'actual choice ACK FSInfo'),total=uint(f.freeSpinsTotal,'actual ACK freeSpinsTotal');
      hold(total>0,'actual positive choice free budget');
      // Ela explicitly initializes local used=0 from its ACTUAL ACK total.
      // This is not a synthetic wire counter, money field or provider response.
      free={freeSpinsTotal:total,freeSpinsPlayed:0,freeSpinsRemaining:total};
      selectedType=undefined;phase='free-ready';return mapped(win,'FREE_SPIN');
    }
    // Pending Decision wins over no-FS/zero-budget close predicates.
    if(d?.pending===true) {
      hold(!has(d.raw,'pickType'),'unmapped pending decision with prior choice type');
      phase='choice-ready';return mapped(win,'PICK');
    }
    if(phase==='await-base') {
      hold(g.FSInfo===undefined && d===undefined,'unmapped direct feature/recovery intro');
      if(paidJackpot)validatePaidJackpot0(g,win);
      else hold(Number.isSafeInteger(ordinaryWin) && ordinaryWin===win,'original paid validation required');
      free=undefined;phase='end-ready';return mapped(win,'PLAY');
    }
    const f=obj(g.FSInfo,'actual free response FSInfo'),played=sourceLocalUsed(f);
    hold(free,'free response outside consumed choice scope');
    let total,remaining;
    if(has(f,'freeSpinsTotal')) {
      total=uint(f.freeSpinsTotal,'actual freeSpinsTotal');hold(played<=total,'actual free budget');remaining=total-played;
    } else {
      remaining=uint(f.spinsRemaining,'actual spinsRemaining');total=played+remaining;hold(Number.isSafeInteger(total),'actual free total');
    }
    // No cross-counter equality/monotonicity admission rule. Native k4 uses
    // actual h1-used, or actual UPa only if h1 is absent. Missing both holds;
    // missing played does NOT make budget zero or authorize an End.
    free={freeSpinsTotal:total,freeSpinsPlayed:played,freeSpinsRemaining:remaining};
    phase=remaining>0?'free-ready':'end-ready';return mapped(win,remaining>0?'FREE_SPIN':'PLAY');
  }
  function pickProtocol(action) {
    live();hold(action==='PICK' && phase==='choice-ready','no current decision');
    // AG's existing positive menu index1 maps explicitly to native type0.
    // No option for native TopUp5 is offered or consumed.
    return {kind:'choice',event:'Logic',options:[{pickIndex:1,requestPickIndex:0,requestParams:{...CHOICE}}]};
  }
  function exact(action) {
    live();
    if(action==='PICK'){hold(phase==='choice-ready','choice selector');return {event:'Logic',parameters:{...CHOICE}};}
    if(action==='FREE_SPIN'){hold(phase==='free-ready','free selector');return {event:'Logic',parameters:{...STAKE}};}
    hold(action==='PLAY'&&phase==='end-ready','real terminal selector');return {event:'EndGame',parameters:{}};
  }
  function beforeEnd(parameters) {live();hold(phase==='end-ready','End before source terminal');assert.deepEqual(parameters,{},'AG integrity: own32778 End parameters');phase='await-end';}
  function endSucceeded(){live();hold(phase==='await-end','unsent End ACK');phase='base-ready';free=undefined;selectedType=undefined;}
  return Object.freeze({logicPayload,accept,pickProtocol,exact,beforeEnd,endSucceeded,seal(){sealed=true;}});
}
module.exports={create};
