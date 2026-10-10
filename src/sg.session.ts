// SG wire adapter for the complete AG program. No legacy SG processor imports.
// AG still owns the round loop, feature counters, scheduler, quota and Mongo I/O.
import assert from 'assert';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { XMLParser } from 'fast-xml-parser';
import { AGGameConfig } from './ag.types';
import { AGDiscardedRoundError } from './ag.round';
// SG transport evidence mapped into the unchanged original AG error policy.
// This file never retries a request or changes AG scheduling/round handling.
export type SGFaultCategory = 'recoverable-initialization' | 'protocol' | 'execution-unknown';
export type SGRequestKind = 'initialization' | 'round-start' | 'round-follow-up';
export interface SGRequestEvidence {
    event: string;
    requestKind: SGRequestKind;
    gameplayRequestHasBeenSent: boolean;
    httpStatus?: number;
    ordinal: number;
    responseSHA256?: string;
}

export class SGSourceFault extends Error {
    readonly executionUncertain: boolean;
    readonly retryAction: 'original-ag-new-session' | 'stop-preserve-evidence';
    constructor(readonly category: SGFaultCategory, readonly evidence: Readonly<SGRequestEvidence>) {
        // Original AG treats the exact AG integrity prefix as deterministic.
        // Only an untouched Init session is allowed into its finite retry path.
        const prefix = category === 'recoverable-initialization' ? 'SG initialization temporarily unavailable' : 'AG integrity: SG ' + category;
        super(prefix + ' ' + JSON.stringify({ event: evidence.event, requestKind: evidence.requestKind,
            httpStatus: evidence.httpStatus, ordinal: evidence.ordinal }));
        this.name = 'SGSourceFault';
        this.executionUncertain = category === 'execution-unknown';
        this.retryAction = category === 'recoverable-initialization' ? 'original-ag-new-session' : 'stop-preserve-evidence';
        this.evidence = Object.freeze({ ...evidence });
    }
}

export class SGClosedFreeSessionDiscard extends AGDiscardedRoundError {
    readonly executionUncertain=true;
    readonly oldRequestMayHaveExecuted=true;
    readonly oldRequestReplays=0;
    readonly retryAction='original-ag-discard-then-new-free-session';
    constructor(readonly originalFault:SGSourceFault) {
        super(originalFault.evidence.event);
        this.name='SGClosedFreeSessionDiscard';
        // Do not claim an error-only response or that the old wager failed.
        this.message='SG uncertain Free round sealed; discard and create a new Free session for future samples';
    }
}

const transientInitStatuses = new Set([408, 425, 429, 500, 502, 503, 504]);
function untouchedInit(evidence: SGRequestEvidence): boolean {
    return evidence.event === 'Init' && evidence.requestKind === 'initialization'
        && evidence.ordinal === 1 && evidence.gameplayRequestHasBeenSent === false;
}

export function httpSourceFault(evidence: SGRequestEvidence): SGSourceFault {
    if (!Number.isInteger(evidence.httpStatus) || evidence.httpStatus! < 100 || evidence.httpStatus! > 599
        || (evidence.httpStatus! >= 200 && evidence.httpStatus! < 300)) {
        throw new Error('AG integrity: SG invalid HTTP fault evidence');
    }
    if (untouchedInit(evidence)) {
        return new SGSourceFault(transientInitStatuses.has(evidence.httpStatus!) ? 'recoverable-initialization' : 'protocol', evidence);
    }
    // HTTP status/body alone cannot prove a wager, feature or EndGame was not
    // applied. Keep the request outcome uncertain; never re-send this POST.
    return new SGSourceFault('execution-unknown', evidence);
}

export function transportSourceFault(evidence: SGRequestEvidence): SGSourceFault {
    return new SGSourceFault(untouchedInit(evidence) ? 'recoverable-initialization' : 'execution-unknown', evidence);
}

export function sourceFaultMetadata(fault: SGSourceFault) {
    return { faultCategory: fault.category, requestKind: fault.evidence.requestKind,
        executionUncertain: fault.executionUncertain, retryAction: fault.retryAction,
        ...(fault.evidence.responseSHA256 ? { responseSHA256: fault.evidence.responseSHA256 } : {}) };
}


type WireStep = {msgId: string; requestPayload: string; responsePayload: string; responseBalance?: number; elapsedMs?: number; httpStatus?: number};
type WireTransport = (event: string, payload: string) => Promise<WireStep>;
const xml = new XMLParser({ignoreAttributes:false,attributeNamePrefix:'',parseAttributeValue:false,parseTagValue:false});
const list = (v: any): any[] => v === undefined ? [] : Array.isArray(v) ? v : [v];
const integer = (v: unknown, name: string): number => {
    assert(typeof v === 'string' && /^\d+$/.test(v), `AG integrity: SG missing ${name}`);
    const n = Number(v); assert(Number.isSafeInteger(n), `AG integrity: SG unsafe ${name}`); return n;
};
const escape = (v: unknown) => String(v).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');


// Own Dragon client decodes these as board positions, not network actions or wins.
// Bind the decoder to this exact game and its declared 5-by-3 wild features.

// Golden Chief client parses these paid-spin display fields without requesting
// another wager. Real gamble/totem/free fields still require their own mapping.
function ownPaidKeys(value:any,names:string,label:string) {
 assert(value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join('|')===names.split('|').sort().join('|'),`AG integrity: SG ${label} schema`);
}
function ownPositionNumbers(value:any,count:number|undefined,label:string):number[] {
 assert(typeof value==='string'&&/^\d+(\|\d+)*$/.test(value),`AG integrity: SG ${label} positions`);
 const numbers=value.split('|').map((n:string)=>integer(n,label));
 if(count!==undefined)assert(numbers.length===count,`AG integrity: SG ${label} position count`);
 return numbers;
}
function ownHealthyPaidBinding(game:AGGameConfig):'desert'|'jinji' {
 if(game.sg.desertCatsContract) {
  assert(game.gameId==='32762'&&game.dbName==='sg_desertcats'&&game.sg.runtimeGameId===32984&&game.sg.header.gameID==='20315'&&game.sg.header.gameCodeRGI==='desertcats'&&game.sg.desertCatsContract==='desert-cats-own-paid-components-v1'&&game.sg.logicPaylineCount==='50'&&game.sg.betRaw===200,'AG integrity: SG Desert Cats own binding');return 'desert';
 }
 assert(game.gameId==='32778'&&game.dbName==='sg_jinjibaoxiendlesstreasure'&&game.sg.runtimeGameId===33000&&game.sg.header.gameID==='20322'&&game.sg.header.gameCodeRGI==='jinjibaoxiendlesstreasure'&&game.sg.jinjiEndlessContract==='jinji-endless-own-scatter-bank-v1'&&game.sg.logicPaylineCount==='1'&&game.sg.betRaw===16,'AG integrity: SG Jin Ji Endless own binding');return 'jinji';
}
// Observed paid rounds only. Real new gameplay branches require own evidence;
// display values stay in exact source bytes and cannot create extra money.
export function validateOwnRequestVariantData(game:AGGameConfig,g:any,freeIntro=false):number {
 if(freeIntro)assert(game.gameId==='32769'&&game.sg.fudaFreeContract==='fuda-own-natural-free-v4','AG integrity: SG Fu own free scope');
 const fuda=!!game.sg.fudaPaidContract,label=fuda?'Fu Dao Le':'Heidis Bier Haus';
 if(fuda)assert(game.gameId==='32769'&&game.dbName==='sg_fudaole'&&game.sg.runtimeGameId===32991&&game.sg.header.gameID==='20135'&&game.sg.header.gameCodeRGI==='fudaole'&&game.sg.logicRequestNode==='WagerInfo'&&game.sg.fudaPaidContract==='fuda-own-natural-paid-display-v3'&&game.sg.betRaw===200,'AG integrity: SG Fu Dao Le binding');
 else assert(game.gameId==='32772'&&game.dbName==='sg_heidis_bier_haus'&&game.sg.runtimeGameId===32994&&game.sg.header.gameID==='20157'&&game.sg.header.gameCodeRGI==='heidisbierhaus'&&game.sg.heidiPaidContract==='heidi-own-paid-display-v1'&&game.sg.betRaw===75,'AG integrity: SG Heidis binding');
 ownPaidKeys(g,fuda?'totalStake|waysCount|totalWin|betID|MysteryRepSymbol|ReelResults|GameWinInfo|GameRtpInfo'+(freeIntro?'|Feature':''):'stake|stakePerLine|paylineCount|totalWin|betID|ReelResults|MystInfo|WildInfo|BaseGameInfo'+(g.BonusReplacementInfo!==undefined?'|BonusReplacementInfo':''),label);
 assert(integer(fuda?g.totalStake:g.stake,label+' stake')===game.sg.betRaw&&typeof g.betID==='string',`AG integrity: SG ${label} stake`);
 if(fuda)assert(g.waysCount==='243',`AG integrity: SG ${label} ways`);else assert(g.stakePerLine==='1'&&g.paylineCount==='50',`AG integrity: SG ${label} line stake`);
 ownPaidKeys(g.ReelResults,'numSpins|ReelSpin',label+' reel');const reels=list(g.ReelResults.ReelSpin);assert(g.ReelResults.numSpins==='1'&&reels.length===1,`AG integrity: SG ${label} reel count`);const r=reels[0];
 const redEnvelope=fuda&&g.MysteryRepSymbol?.isRedEnvlpJkpt==='Y';
 ownPaidKeys(r,fuda?'reelsetIndex|anywayWinCount|scatterWinCount|totalWayWin|totalScatterWin|totalSpinWin|freeSpin|bonusAwarded|ReelStops'+(r.AnywayWin!==undefined?'|AnywayWin':'')+(r.ScatterWin!==undefined?'|ScatterWin':''):'spinIndex|reelsetIndex|winCountPL|winCountSC|spinWins|freeSpin|bonusAwarded|ReelStops'+(r.PaylineWin!==undefined?'|PaylineWin':''),label+' spin');
 integer(r.reelsetIndex,label+' reel set');assert(r.freeSpin===(freeIntro?'Y':'N')&&r.bonusAwarded===(freeIntro||redEnvelope?'Y':'N')&&(freeIntro||redEnvelope?integer(r.scatterWinCount,label+' scatter count')>0:(fuda?r.scatterWinCount:r.winCountSC)==='0'),`AG integrity: SG ${label} feature needs own mapping`);if(!fuda)assert(r.spinIndex==='0',`AG integrity: SG ${label} spin order`);ownPositionNumbers(r.ReelStops,fuda?5:6,label+' reel positions');
 const wins=list(fuda?r.AnywayWin:r.PaylineWin),seen=new Set<number>();assert(wins.length===integer(fuda?r.anywayWinCount:r.winCountPL,label+' win count'),`AG integrity: SG ${label} win count`);let win=0;
 for(const w of wins) {
  ownPaidKeys(w,fuda?'winIndex|winVal|ways|awardIndex|#text':'index|winVal|awardIndex|awardTableIndex|#text',label+' prize');const i=integer(fuda?w.winIndex:w.index,label+' prize index');assert(!seen.has(i)&&(fuda?i<wins.length:i<50),`AG integrity: SG ${label} duplicate prize`);seen.add(i);integer(w.awardIndex,label+' award');
  if(fuda){const ways=integer(w.ways,label+' ways');assert(ways>0&&ways<=243,`AG integrity: SG ${label} ways bound`);}else assert(w.awardTableIndex==='0',`AG integrity: SG ${label} award table`);
  ownPositionNumbers(w['#text'],undefined,label+' prize positions');win+=integer(w.winVal,label+' win');
 }
 if(fuda){
  assert(win===integer(r.totalWayWin,label+' way win'),`AG integrity: SG ${label} way components`);
  const scatters=list(r.ScatterWin),scatterIndexes=new Set<number>();assert(scatters.length===integer(r.scatterWinCount,label+' scatter count'),`AG integrity: SG ${label} scatter count`);let scatterWin=0;
  for(const w of scatters){ownPaidKeys(w,'winIndex|winVal|awardIndex|#text',label+' scatter');const i=integer(w.winIndex,label+' scatter index');assert(i<scatters.length&&!scatterIndexes.has(i),`AG integrity: SG ${label} duplicate scatter`);scatterIndexes.add(i);integer(w.awardIndex,label+' scatter award');const positions=ownPositionNumbers(w['#text'],undefined,label+' scatter positions');assert(positions.every(p=>p<15)&&new Set(positions).size===positions.length,`AG integrity: SG ${label} scatter board`);scatterWin+=integer(w.winVal,label+' scatter money');}
  assert(Number.isSafeInteger(scatterWin)&&scatterWin===integer(r.totalScatterWin,label+' scatter total')&&(redEnvelope?scatterWin>0:scatterWin===0),`AG integrity: SG ${label} scatter components`);win+=scatterWin;
 }
 assert(Number.isSafeInteger(win)&&win===integer(fuda?r.totalSpinWin:r.spinWins,label+' spin win')&&win===integer(g.totalWin,label+' root win'),`AG integrity: SG ${label} current money`);
 if(fuda) {
  ownPaidKeys(g.GameWinInfo,'totalWagerWin|totalBaseGameWin|totalFreeSpinsWin|totalPickJkptWin|maxWinValue|isMaxWin',label+' winnings');ownPaidKeys(g.GameRtpInfo,'targetedRtpValue',label+' RTP');
  const w=g.GameWinInfo;assert(integer(w.totalBaseGameWin,label+' base')===win&&integer(w.totalWagerWin,label+' cumulative')===win&&w.totalFreeSpinsWin==='0'&&w.totalPickJkptWin==='0'&&w.maxWinValue==='25000000'&&w.isMaxWin==='N'&&g.GameRtpInfo.targetedRtpValue==='96.06',`AG integrity: SG ${label} money or feature`);
  const m=g.MysteryRepSymbol;ownPaidKeys(m,'isSymPresent|replacementSymbolIndex|isNudgingWild|isRedEnvlpJkpt'+(m.nudgingWildPositions!==undefined?'|nudgingWildPositions':''),label+' mystery');assert(['Y','N'].includes(m.isSymPresent)&&['Y','N'].includes(m.isNudgingWild)&&['Y','N'].includes(m.isRedEnvlpJkpt),`AG integrity: SG ${label} own feature mapping`);integer(m.replacementSymbolIndex,label+' mystery symbol');
  // The client animates already returned nudging cells; there is no extra
  // wager/Pick request. Root, ways/scatter and final cash remain authoritative.
  if(m.isNudgingWild==='Y'){const positions=ownPositionNumbers(m.nudgingWildPositions,undefined,label+' nudging cells');assert(positions.length>0&&positions.every(p=>p<15)&&new Set(positions).size===positions.length,`AG integrity: SG ${label} nudging board`);}
  else assert(m.nudgingWildPositions===undefined||m.nudgingWildPositions==='',`AG integrity: SG ${label} unflagged nudging`);
 } else {
  ownPaidKeys(g.BaseGameInfo,'totalWagerWin|isMaxWin|maxWinValue',label+' base');assert(integer(g.BaseGameInfo.totalWagerWin,label+' cumulative')===win&&g.BaseGameInfo.isMaxWin==='N'&&g.BaseGameInfo.maxWinValue==='25000000',`AG integrity: SG ${label} cumulative money`);
  ownPaidKeys(g.MystInfo,'index',label+' mystery');const mystery=integer(g.MystInfo.index,label+' mystery index');ownPaidKeys(g.WildInfo,'Indices',label+' wild');const wild=g.WildInfo.Indices===''?[]:ownPositionNumbers(g.WildInfo.Indices,undefined,label+' wild reels');assert(wild.every(i=>i<6)&&new Set(wild).size===wild.length,`AG integrity: SG ${label} wild reels`);
  if(mystery===13) {
   ownPaidKeys(g.BonusReplacementInfo,'Reel0|Reel1|Reel2|Reel3|Reel4|Reel5',label+' replacement reels');
   for(let i=0;i<6;i++) {const reel=g.BonusReplacementInfo['Reel'+i];if(reel==='')continue;ownPaidKeys(reel,'RD',label+' replacement');const used=new Set<number>();for(const d of list(reel.RD)){ownPaidKeys(d,'SS|DS',label+' replacement entry');const source=integer(d.SS,label+' source symbol');assert(source>=23&&source<35&&!used.has(source),`AG integrity: SG ${label} replacement index`);used.add(source);integer(d.DS,label+' destination symbol');}}
  } else assert(g.BonusReplacementInfo===undefined,`AG integrity: SG ${label} unexpected replacement`);
 }
 return win;
}
export function validateFudaOwnFreeData(game:AGGameConfig,g:any,first:boolean,prior:any,base:any,previousWin:number) {
 assert(game.gameId==='32769'&&game.dbName==='sg_fudaole'&&game.sg.fudaPaidContract==='fuda-own-natural-paid-display-v3'&&game.sg.fudaFreeContract==='fuda-own-natural-free-v4','AG integrity: SG Fu own free binding');
 if(first&&g.Feature===undefined)return {win:validateOwnRequestVariantData(game,g),free:undefined,base:undefined};
 ownPaidKeys(g.Feature,'index|name|data','Fu free feature');assert(g.Feature.index==='1'&&g.Feature.name==='FreeGame','AG integrity: SG Fu unreviewed feature');
 if(first){
  assert(!prior&&!base&&previousWin===0,'AG integrity: SG Fu intro order');
  ownPaidKeys(g.Feature.data,'remainingFreeSpins|extraFreeSpinsAwarded|totalFreeSpinsPlayed|freeSpinTriggerWin','Fu intro counters');
  const f=g.Feature.data,total=integer(f.remainingFreeSpins,'Fu returned free total');assert(total>0&&f.totalFreeSpinsPlayed==='0'&&f.extraFreeSpinsAwarded==='0','AG integrity: SG Fu intro counters');integer(f.freeSpinTriggerWin,'Fu trigger display win');
  const win=validateOwnRequestVariantData(game,g,true);
  return {win,free:{freeSpinsTotal:total,freeSpinsPlayed:0,freeSpinsRemaining:total,accumulativeWin:win/100},base:structuredClone(g)};
 }
 assert(prior&&prior.freeSpinsRemaining>0&&base,'AG integrity: SG Fu free continuation order');
 ownPaidKeys(g,'totalStake|waysCount|totalWin|betID|MysteryRepSymbol|ReelResults|Feature|BaseGameRecoveryInfo|GameWinInfo|GameRtpInfo','Fu free result');
 assert(g.totalStake==='200'&&g.waysCount==='243'&&g.betID===base.betID,'AG integrity: SG Fu free wager');
 ownPaidKeys(g.Feature.data,'remainingFreeSpins|extraFreeSpinsAwarded|totalFreeSpinsPlayed|freeSpinTriggerWin|lastFreeSpin','Fu free counters');
 const f=g.Feature.data,remaining=integer(f.remainingFreeSpins,'Fu free remaining'),played=integer(f.totalFreeSpinsPlayed,'Fu free played'),award=integer(f.extraFreeSpinsAwarded,'Fu actual awarded'),trigger=integer(f.freeSpinTriggerWin,'Fu free trigger');
 assert(played===prior.freeSpinsPlayed+1&&remaining===prior.freeSpinsRemaining-1+award&&remaining+played===prior.freeSpinsTotal+award&&trigger===integer(base.Feature.data.freeSpinTriggerWin,'Fu original trigger')&&f.lastFreeSpin===(remaining===0?'Y':'N'),'AG integrity: SG Fu counter or terminal');
 ownPaidKeys(g.BaseGameRecoveryInfo,'GameResult','Fu own recovery');
 const projection={totalStake:base.totalStake,waysCount:base.waysCount,totalWin:base.totalWin,betID:base.betID,MysteryRepSymbol:base.MysteryRepSymbol,ReelResults:base.ReelResults};
 assert.deepStrictEqual(g.BaseGameRecoveryInfo.GameResult,projection,'AG integrity: SG Fu base recovery changed');
 ownPaidKeys(g.ReelResults,'numSpins|ReelSpin','Fu free reels');assert(g.ReelResults.numSpins==='1'&&!Array.isArray(g.ReelResults.ReelSpin),'AG integrity: SG Fu free reel count');
 const r=g.ReelResults.ReelSpin,m=g.MysteryRepSymbol,red=m?.isRedEnvlpJkpt==='Y';
 ownPaidKeys(r,'reelsetIndex|anywayWinCount|scatterWinCount|totalWayWin|totalScatterWin|totalSpinWin|freeSpin|bonusAwarded|ReelStops'+(r.AnywayWin!==undefined?'|AnywayWin':'')+(r.ScatterWin!==undefined?'|ScatterWin':''),'Fu free reel');
 integer(r.reelsetIndex,'Fu free set');ownPositionNumbers(r.ReelStops,5,'Fu free stops');assert(r.freeSpin==='Y'&&r.bonusAwarded===(red?'Y':'N'),'AG integrity: SG Fu free marker');
 const ways=list(r.AnywayWin),scatters=list(r.ScatterWin);assert(ways.length===integer(r.anywayWinCount,'Fu free way count')&&scatters.length===integer(r.scatterWinCount,'Fu free scatter count'),'AG integrity: SG Fu free declared awards');
 let wayWin=0,scatterWin=0;const wayIds=new Set<number>(),scatterIds=new Set<number>();
 for(const w of ways){ownPaidKeys(w,'winIndex|winVal|ways|awardIndex|#text','Fu free way');const id=integer(w.winIndex,'Fu free way id'),count=integer(w.ways,'Fu free way count');assert(id<ways.length&&!wayIds.has(id)&&count>0&&count<=243,'AG integrity: SG Fu free way index');wayIds.add(id);integer(w.awardIndex,'Fu free award');const pos=ownPositionNumbers(w['#text'],undefined,'Fu free way positions');assert(pos.every(p=>p<15)&&new Set(pos).size===pos.length,'AG integrity: SG Fu free way board');wayWin+=integer(w.winVal,'Fu free way cash');}
 for(const w of scatters){ownPaidKeys(w,'winIndex|winVal|awardIndex|#text','Fu free scatter');const id=integer(w.winIndex,'Fu free scatter id');assert(id<scatters.length&&!scatterIds.has(id),'AG integrity: SG Fu free scatter index');scatterIds.add(id);integer(w.awardIndex,'Fu free scatter award');const pos=ownPositionNumbers(w['#text'],undefined,'Fu free scatter positions');assert(pos.every(p=>p<15)&&new Set(pos).size===pos.length,'AG integrity: SG Fu free scatter board');scatterWin+=integer(w.winVal,'Fu free scatter cash');}
 const current=integer(g.totalWin,'Fu free current');assert(Number.isSafeInteger(wayWin)&&Number.isSafeInteger(scatterWin)&&wayWin===integer(r.totalWayWin,'Fu free ways')&&scatterWin===integer(r.totalScatterWin,'Fu free scatters')&&(red?scatterWin>0:scatterWin===0)&&current===wayWin+scatterWin&&current===integer(r.totalSpinWin,'Fu free spin cash'),'AG integrity: SG Fu free current components');
 ownPaidKeys(m,'isSymPresent|replacementSymbolIndex|isNudgingWild|isRedEnvlpJkpt'+(m.nudgingWildPositions!==undefined?'|nudgingWildPositions':''),'Fu free mystery');assert(['Y','N'].includes(m.isSymPresent)&&['Y','N'].includes(m.isNudgingWild)&&['Y','N'].includes(m.isRedEnvlpJkpt),'AG integrity: SG Fu free display flags');integer(m.replacementSymbolIndex,'Fu free mystery symbol');
 if(m.isNudgingWild==='Y'){const pos=ownPositionNumbers(m.nudgingWildPositions,undefined,'Fu free nudging');assert(pos.length>0&&pos.every(p=>p<15)&&new Set(pos).size===pos.length,'AG integrity: SG Fu free nudging board');}else assert(m.nudgingWildPositions===undefined||m.nudgingWildPositions==='','AG integrity: SG Fu unflagged free nudging');
 ownPaidKeys(g.GameWinInfo,'totalWagerWin|totalBaseGameWin|totalFreeSpinsWin|totalPickJkptWin|maxWinValue|isMaxWin','Fu free winnings');ownPaidKeys(g.GameRtpInfo,'targetedRtpValue','Fu free RTP');
 const w=g.GameWinInfo,baseWin=integer(base.totalWin,'Fu original paid cash'),win=integer(w.totalWagerWin,'Fu returned cumulative'),freeWin=integer(w.totalFreeSpinsWin,'Fu returned free cash');
 // The returned trigger display award enters cumulative free cash on the first
 // natural free response, exactly once. It is absent from paid current cash.
 assert(integer(w.totalBaseGameWin,'Fu unchanged base cash')===baseWin&&win===baseWin+freeWin&&win===previousWin+current+(prior.freeSpinsPlayed===0?trigger:0)&&w.totalPickJkptWin==='0'&&w.maxWinValue==='25000000'&&w.isMaxWin==='N'&&g.GameRtpInfo.targetedRtpValue==='96.06','AG integrity: SG Fu free cumulative components');
 return {win,free:{freeSpinsTotal:remaining+played,freeSpinsPlayed:played,freeSpinsRemaining:remaining,accumulativeWin:win/100},base};
}
// Own Cool Jewels client decodes each cascade cell award, not an extra wager.
// This contract covers actual ordinary cascade records; new Feature data is
// retained as a real own fault rather than manufactured as a zero bonus.
export function validateCoolJewelsFreeData(game:AGGameConfig,g:any,first:boolean,prior:any,base:any,previousWin:number){
 assert(game.sg.coolJewelsFreeContract==='cool-jewels-own-topup-retrigger-v3','AG integrity: SG Cool Jewels own free contract');
 if(first&&!g.Feature)return {win:validateCoolJewelsPaidData(game,g),free:undefined,base:undefined};
 ownPaidKeys(g.Feature,'index|FS_Info','Cool Jewels feature');assert(g.Feature.index==='0'&&!Array.isArray(g.Feature.FS_Info),'AG integrity: SG Cool Jewels feature index');
 const f=g.Feature.FS_Info;
 if(first){
  ownPaidKeys(f,'fsAwarded','Cool Jewels paid free intro');const total=integer(f.fsAwarded,'Cool Jewels actual intro budget');assert(total>0,'AG integrity: SG Cool Jewels zero intro');
  const win=validateCoolJewelsPaidData(game,g,'trigger');return {win,base:structuredClone(g),free:{freeSpinsTotal:total,freeSpinsPlayed:0,freeSpinsRemaining:total,accumulativeWin:win/100}};
 }
 assert(prior&&base,'AG integrity: SG Cool Jewels missing original free state');
 ownPaidKeys(f,'totalSpinsWon|currentSpin|entryWin|currentFSWins|totalGameWins|winTopUp|fsAwarded','Cool Jewels free counters and money');
 const total=integer(f.totalSpinsWon,'Cool Jewels actual total'),played=integer(f.currentSpin,'Cool Jewels played'),award=integer(f.fsAwarded,'Cool Jewels returned award');
 assert(played===prior.freeSpinsPlayed+1&&total===prior.freeSpinsTotal+award&&played<=total,'AG integrity: SG Cool Jewels nonadvancing or lost free budget');
 const current=validateCoolJewelsPaidData(game,g,'free'),entry=integer(f.entryWin,'Cool Jewels original entry cash'),freeWin=integer(f.currentFSWins,'Cool Jewels cumulative free cash'),win=integer(f.totalGameWins,'Cool Jewels total cash');
 const topup=integer(f.winTopUp,'Cool Jewels actual terminal guarantee');assert(played===total||topup===0,'AG integrity: SG Cool Jewels premature guarantee');
 assert(entry===integer(base.totalWin,'Cool Jewels original paid cash')&&entry+freeWin+topup===win&&previousWin+current+topup===win,'AG integrity: SG Cool Jewels cash components or cumulative delta');
 if(played===total){
  ownPaidKeys(g.PreFS_Info,'visSymbols','Cool Jewels terminal paid display');ownPositionNumbers(g.PreFS_Info.visSymbols,36,'Cool Jewels recovery symbols');
  const drops=list(base.ReactorChain.ReactorDrop),original=drops[drops.length-1].ReactorLayout.symbols;assert(g.PreFS_Info.visSymbols===original,'AG integrity: SG Cool Jewels original paid display changed');
 }else assert(g.PreFS_Info===undefined,'AG integrity: SG Cool Jewels premature recovery');
 return {win,base,free:{freeSpinsTotal:total,freeSpinsPlayed:played,freeSpinsRemaining:total-played,accumulativeWin:win/100}};
}
export function validateCoolJewelsPaidData(game:AGGameConfig,g:any,mode:'ordinary'|'trigger'|'free'='ordinary'):number {
 assert(game.gameId==='32758'&&game.dbName==='sg_cooljewels_prt'&&game.sg.runtimeGameId===32980&&game.sg.header.gameID==='20150'&&game.sg.header.gameCodeRGI==='cooljewels_prt'&&game.sg.coolJewelsPaidContract==='cool-jewels-own-reactor-paid-v1'&&game.sg.betRaw===50,'AG integrity: SG Cool Jewels own binding');
 assert(mode==='ordinary'||game.sg.coolJewelsFreeContract==='cool-jewels-own-topup-retrigger-v3','AG integrity: SG Cool Jewels free binding');
 ownPaidKeys(g,'stake|stakePerLine|paylineCount|totalWin|betID|ReelResults|ReactorChain|MaxWin_Info'+(mode!=='ordinary'?'|Feature':'')+(mode==='free'&&g.PreFS_Info!==undefined?'|PreFS_Info':''),'Cool Jewels result');assert(g.stake==='50'&&g.stakePerLine==='0'&&g.paylineCount==='0'&&typeof g.betID==='string','AG integrity: SG Cool Jewels own wager');
 ownPaidKeys(g.ReelResults,'numSpins|ReelSpin','Cool Jewels reels');assert(g.ReelResults.numSpins==='1'&&!Array.isArray(g.ReelResults.ReelSpin),'AG integrity: SG Cool Jewels reel count');const r=g.ReelResults.ReelSpin;
 ownPaidKeys(r,'spinIndex|reelsetIndex|winCountPL|winCountSC|spinWins|freeSpin|bonusAwarded|ReelStops','Cool Jewels ordinary reel');assert(r.spinIndex==='0'&&r.winCountPL==='0'&&r.winCountSC==='0'&&r.spinWins==='0'&&r.freeSpin===(mode==='free'?'Y':'N')&&r.bonusAwarded===(mode==='trigger'?'Y':'N'),'AG integrity: SG Cool Jewels new action or reel cash');integer(r.reelsetIndex,'Cool Jewels reel set');ownPositionNumbers(r.ReelStops,6,'Cool Jewels stops');
 ownPaidKeys(g.ReactorChain,'num_drops|ReactorDrop','Cool Jewels chain');const drops=list(g.ReactorChain.ReactorDrop);assert(drops.length>0&&drops.length===integer(g.ReactorChain.num_drops,'Cool Jewels drop count'),'AG integrity: SG Cool Jewels chain count');
 const coordinate=(value:any)=>{assert(typeof value==='string'&&/^\d+,\d+$/.test(value),'AG integrity: SG Cool Jewels position');const pos=value.split(',').map((q:string)=>integer(q,'Cool Jewels coordinate'));assert(pos.every((q:number)=>q<6),'AG integrity: SG Cool Jewels board');return value;};
 let total=0;
 for(const [i,d]of drops.entries()){
  ownPaidKeys(d,'drop_order|num_clusters|ReactorLayout'+(d.ReactorCluster!==undefined?'|ReactorCluster':''),'Cool Jewels drop');assert(integer(d.drop_order,'Cool Jewels drop order')===i,'AG integrity: SG Cool Jewels drop order');ownPaidKeys(d.ReactorLayout,'symbols','Cool Jewels layout');ownPositionNumbers(d.ReactorLayout.symbols,36,'Cool Jewels symbols');
  const clusters=list(d.ReactorCluster);assert(clusters.length===integer(d.num_clusters,'Cool Jewels cluster count'),'AG integrity: SG Cool Jewels cluster count');
  if(i===drops.length-1)assert(clusters.length===0,'AG integrity: SG Cool Jewels incomplete cascade');else assert(clusters.length>0,'AG integrity: SG Cool Jewels empty intermediate cascade');
  for(const [ci,c]of clusters.entries()){
   ownPaidKeys(c,'id|cluster_positions|cluster_awards|rootSymbol|rootSymbolPos|watermark','Cool Jewels cluster');assert(integer(c.id,'Cool Jewels cluster id')===ci,'AG integrity: SG Cool Jewels cluster id');integer(c.rootSymbol,'Cool Jewels root symbol');coordinate(c.rootSymbolPos);integer(c.watermark,'Cool Jewels watermark');assert(typeof c.cluster_positions==='string','AG integrity: SG Cool Jewels cluster positions');const positions=c.cluster_positions.split('|').map(coordinate),awards=ownPositionNumbers(c.cluster_awards,undefined,'Cool Jewels paired awards');assert(positions.length>0&&positions.length===awards.length&&new Set(positions).size===positions.length,'AG integrity: SG Cool Jewels paired awards');total+=awards.reduce((a,b)=>a+b,0);assert(Number.isSafeInteger(total),'AG integrity: SG Cool Jewels unsafe total');
  }
 }
 ownPaidKeys(g.MaxWin_Info,'maxWinValue|maxWin|cappedWins','Cool Jewels cap');assert(g.MaxWin_Info.maxWinValue==='25000000'&&g.MaxWin_Info.maxWin==='false'&&g.MaxWin_Info.cappedWins==='0','AG integrity: SG Cool Jewels own cap mapping needed');assert(total===integer(g.totalWin,'Cool Jewels returned cash'),'AG integrity: SG Cool Jewels current cash components');return total;
}
export function validateHealthyPaidData(game:AGGameConfig,g:any):number {
 const desert=ownHealthyPaidBinding(game)==='desert',label=desert?'Desert Cats':'Jin Ji Endless';
 ownPaidKeys(g,desert?'stake|stakePerLine|paylineCount|totalWin|betID|ReelResults|BGInfo|QuickHits|Symbol|WildReel':'stake|totalWin|betID|ReelResults|BGInfo|MysterySymbol|ScatterInfo',label);
 assert(integer(g.stake,label+' stake')===game.sg.betRaw&&typeof g.betID==='string',`AG integrity: SG ${label} wager`);
 if(desert)assert(g.stakePerLine==='4'&&g.paylineCount==='50',`AG integrity: SG ${label} payline stake`);
 ownPaidKeys(g.BGInfo,desert?'totalWagerWin|bgWinnings|baseGameSpinsRemaining|isBigBet|isMaxWin':'totalWagerWin|bgWinnings|baseGameSpinsRemaining|isMaxWin|goldChanceAwarded|jackpotAwarded|gameMode',label+' base');
 assert(g.BGInfo.baseGameSpinsRemaining==='0'&&g.BGInfo.isMaxWin==='0',`AG integrity: SG ${label} remaining action`);
 if(desert)assert(g.BGInfo.isBigBet==='0',`AG integrity: SG ${label} paid mode`);
 else assert(g.BGInfo.goldChanceAwarded==='0'&&g.BGInfo.jackpotAwarded==='0'&&g.BGInfo.gameMode==='0',`AG integrity: SG ${label} feature needs own mapping`);
 ownPaidKeys(g.ReelResults,'numSpins|ReelSpin',label+' reels');const reels=list(g.ReelResults.ReelSpin);assert(g.ReelResults.numSpins==='1'&&reels.length===1,`AG integrity: SG ${label} current reel count`);const r=reels[0];
 ownPaidKeys(r,desert?'spinIndex|reelsetIndex|winCountPL|winCountSC|spinWins|freeSpin|bonusAwarded|ReelStops'+(r.PaylineWin!==undefined?'|PaylineWin':''):'spinIndex|reelsetIndex|anywayWins|scatterWinCount|totalSpinWin|freeSpin|bonusAwarded|ReelStops'+(r.AnywayWin!==undefined?'|AnywayWin':''),label+' spin');
 assert(r.spinIndex==='0'&&r.reelsetIndex==='0'&&r.freeSpin==='N'&&r.bonusAwarded==='N'&&(desert?r.winCountSC:r.scatterWinCount)==='0',`AG integrity: SG ${label} unclassified feature`);
 ownPositionNumbers(r.ReelStops,desert?7:5,label+' reel stops');const wins=list(desert?r.PaylineWin:r.AnywayWin),seen=new Set<number>();
 assert(wins.length===integer(desert?r.winCountPL:r.anywayWins,label+' win count'),`AG integrity: SG ${label} win count`);let lineWin=0;
 for(const w of wins) {
  ownPaidKeys(w,desert?'index|winVal|awardIndex|awardTableIndex|#text':'winIndex|winVal|ways|awardIndex|#text',label+' win');const index=integer(desert?w.index:w.winIndex,label+' win index');assert(!seen.has(index)&&(desert?index<50:index<wins.length),`AG integrity: SG ${label} win index`);seen.add(index);integer(w.awardIndex,label+' award');
  if(desert)assert(w.awardTableIndex==='0',`AG integrity: SG ${label} award table`);else assert(integer(w.ways,label+' ways')>0,`AG integrity: SG ${label} ways`);
  ownPositionNumbers(w['#text'],undefined,label+' winning positions');lineWin+=integer(w.winVal,label+' line win');
 }
 assert(Number.isSafeInteger(lineWin)&&lineWin===integer(desert?r.spinWins:r.totalSpinWin,label+' spin win'),`AG integrity: SG ${label} reel winnings`);let quickHits=0;
 if(desert) {
  ownPaidKeys(g.QuickHits,'winValue|numOfGems',label+' QuickHits');quickHits=integer(g.QuickHits.winValue,label+' QuickHits win');assert(integer(g.QuickHits.numOfGems,label+' gems')<=10,`AG integrity: SG ${label} gems`);
  ownPaidKeys(g.Symbol,'replacement',label+' symbol');integer(g.Symbol.replacement,label+' replacement');ownPaidKeys(g.WildReel,'pattern',label+' wild reels');assert(ownPositionNumbers(g.WildReel.pattern,7,label+' wild reels').every(n=>n===0||n===1),`AG integrity: SG ${label} wild bit`);
 } else {
  ownPaidKeys(g.MysterySymbol,'replacementSym',label+' mystery symbol');integer(g.MysterySymbol.replacementSym,label+' replacement');ownPaidKeys(g.ScatterInfo,'totalValue|numScatters|values',label+' scatter bank');const values=ownPositionNumbers(g.ScatterInfo.values,15,label+' scatter bank'),bank=values.reduce((a,b)=>a+b,0);
  assert(Number.isSafeInteger(bank)&&bank===integer(g.ScatterInfo.totalValue,label+' bank total')&&integer(g.ScatterInfo.numScatters,label+' scatter count')<=15,`AG integrity: SG ${label} scatter bank`);
 }
 // Desert SDK subtracts QuickHits from totalWin for line animation. Jin Ji
 // ScatterInfo is a bank display, never an additional current win.
 const win=lineWin+quickHits;assert(Number.isSafeInteger(win)&&win===integer(g.totalWin,label+' current win')&&win===integer(g.BGInfo.bgWinnings,label+' base win')&&win===integer(g.BGInfo.totalWagerWin,label+' cumulative win'),`AG integrity: SG ${label} monetary components`);return win;
}
export function validateEightyFortunesData(game:AGGameConfig,g:any,first:boolean,prior:any,paid:any,priorWin:number):any {
 assert(game.gameId==='32750'&&game.dbName==='sg_eightyeightfortunes'&&game.sg?.runtimeGameId===32972&&game.sg?.header?.gameID==='20077'&&game.sg?.header?.gameCodeRGI==='eightyeightfortunes'&&game.sg?.eightyFortunesContract==='eighty-fortunes-own-free-components-v4'&&game.sg?.betRaw===176,'AG integrity: SG 88 Fortunes binding');
 const keys=(v:any,n:string)=>assert(v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join('|')===n.split('|').sort().join('|'),'AG integrity: SG 88 Fortunes schema');
 keys(g,'stake|creditBet|betMultiplier|waysCount|totalWin|betID|ReelResults|GameWinInfo|GameRtpInfo'+(g.Feature?'|Feature':'')+(g.BaseGameRecoveryInfo?'|BaseGameRecoveryInfo':''));
 assert(g.stake==='176'&&g.creditBet==='88'&&g.betMultiplier==='2'&&g.waysCount==='243','AG integrity: SG 88 Fortunes wager');
 keys(g.GameWinInfo,'totalWagerWin|totalBaseGameWin|totalFreeSpinsWin|maxWinValue|isMaxWin');keys(g.GameRtpInfo,'targetedRtpValue');assert(g.GameWinInfo.maxWinValue==='25000000'&&g.GameWinInfo.isMaxWin==='N'&&g.GameRtpInfo.targetedRtpValue==='96.00','AG integrity: SG 88 Fortunes variant/cap');
 keys(g.ReelResults,'ReelSpin|numSpins');const spins=list(g.ReelResults.ReelSpin);assert(g.ReelResults.numSpins==='1'&&spins.length===1,'AG integrity: SG 88 Fortunes reel count');const r=spins[0];
 keys(r,'reelsetIndex|anywayWinCount|scatterWinCount|totalWayWin|totalScatterWin|totalSpinWin|freeSpin|bonusAwarded|ReelStops'+(r.AnywayWin?'|AnywayWin':'')+(r.ScatterWin?'|ScatterWin':''));
 const sets=first?game.sg.eightyFortunesBaseReels:game.sg.eightyFortunesFreeReels;assert(Array.isArray(sets)&&sets.includes(integer(r.reelsetIndex,'88 reel set')),'AG integrity: SG 88 Fortunes advertised reel set');
 assert(typeof r.ReelStops==='string'&&/^\d+(?:\|\d+){4}$/.test(r.ReelStops),'AG integrity: SG 88 Fortunes reel stops');r.ReelStops.split('|').forEach((v:string)=>integer(v,'88 reel stop'));
 const way=list(r.AnywayWin),scatter=list(r.ScatterWin);assert(way.length===integer(r.anywayWinCount,'88 way count')&&scatter.length===integer(r.scatterWinCount,'88 scatter count'),'AG integrity: SG 88 Fortunes win count');
 const sum=(rows:any[],isWay:boolean)=>{let total=0;const seen=new Set<number>();for(const w of rows){keys(w,'#text|winIndex|winVal|awardIndex'+(isWay?'|ways':''));const i=integer(w.winIndex,'88 win index');assert(!seen.has(i),'AG integrity: SG 88 Fortunes repeated win index');seen.add(i);integer(w.awardIndex,'88 award');if(isWay){const n=integer(w.ways,'88 ways');assert(n>0&&n<=243,'AG integrity: SG 88 Fortunes ways');}assert(typeof w['#text']==='string'&&/^\d+(?:\|\d+)*$/.test(w['#text'])&&w['#text'].split('|').every((v:string)=>integer(v,'88 position')<15),'AG integrity: SG 88 Fortunes positions');total+=integer(w.winVal,'88 win');}assert(Number.isSafeInteger(total),'AG integrity: SG 88 Fortunes money overflow');return total;};
 const ways=sum(way,true),scatters=sum(scatter,false),current=integer(g.totalWin,'88 current'),win=integer(g.GameWinInfo.totalWagerWin,'88 wager win'),base=integer(g.GameWinInfo.totalBaseGameWin,'88 base win'),freeWin=integer(g.GameWinInfo.totalFreeSpinsWin,'88 free win');
 const features=list(g.Feature),indices=new Set<string>();for(const f of features){keys(f,'data|index|name');assert(!indices.has(f.index),'AG integrity: SG 88 repeated feature');indices.add(f.index);}
 const freeFeature=features.find((f:any)=>f.index==='1'&&f.name==='FreeGame'),jackpotFeature=features.find((f:any)=>f.index===(first?'2':'3')&&f.name===(first?'BG_FuBat_Jackpot':'FG_FuBat_Jackpot'));
 assert(features.length===(freeFeature?1:0)+(jackpotFeature?1:0)&&features.length<=2,'AG integrity: SG 88 Fortunes feature requires own mapping');
 const paidJackpot=first&&jackpotFeature!==undefined,freeJackpot=!first&&jackpotFeature!==undefined;let jackpot=0;
 if(jackpotFeature){
  const f=jackpotFeature.data;keys(f,'#text|pickLength|jackpotWin|jackpotType');assert(typeof f['#text']==='string'&&/^[0-3](?:\|[0-3])*$/.test(f['#text']),'AG integrity: SG 88 precomputed jackpot picks');const picks=f['#text'].split('|').map(Number),type=integer(f.jackpotType,'88 jackpot type');assert(type<4&&picks.length===integer(f.pickLength,'88 jackpot pick length')&&picks.filter((v:number)=>v===type).length===3&&r.bonusAwarded==='Y','AG integrity: SG 88 completed jackpot picks');
  if(paidJackpot)assert(!prior&&g.BaseGameRecoveryInfo===undefined&&r.freeSpin===(freeFeature?'Y':'N')&&(freeFeature||freeWin===0),'AG integrity: SG 88 paid jackpot state');
  else assert(prior&&paid&&freeFeature,'AG integrity: SG 88 free jackpot state');jackpot=integer(f.jackpotWin,'88 jackpot amount');
 }
 const trigger=freeFeature?integer(freeFeature.data.freeSpinTriggerWin,'88 trigger'):0;
 // In an ongoing free game the response's current award already includes
 // the retrigger and jackpot components. Each enters the cumulative total once.
 assert(ways===integer(r.totalWayWin,'88 total ways')&&scatters===integer(r.totalScatterWin,'88 total scatter')&&ways+scatters===integer(r.totalSpinWin,'88 spin win')&&ways+scatters+jackpot+(first?0:trigger)===current&&base+freeWin===win&&Number.isSafeInteger(win),'AG integrity: SG 88 Fortunes monetary components');
 if(paidJackpot&&!freeFeature){assert(base===current&&win===current,'AG integrity: SG 88 paid jackpot amount');return {win,free:undefined};}
 if(!g.Feature){assert(first&&!prior&&g.BaseGameRecoveryInfo===undefined&&r.freeSpin==='N'&&r.bonusAwarded==='N'&&freeWin===0&&base===current,'AG integrity: SG 88 Fortunes unclassified state');return {win,free:undefined};}
 assert(freeFeature,'AG integrity: SG 88 missing free feature');const f=freeFeature.data;keys(f,'totalFreeSpinsWin|remainingFreeSpins|extraFreeSpinsAwarded|freeSpinTriggerWin|lastFreeSpin');
 const remaining=integer(f.remainingFreeSpins,'88 remaining'),extra=integer(f.extraFreeSpinsAwarded,'88 extra');assert(integer(f.totalFreeSpinsWin,'88 feature cumulative')===freeWin&&f.lastFreeSpin===(remaining===0?'Y':'N'),'AG integrity: SG 88 Fortunes free state');
 let played,total;
 if(first){assert(!prior&&g.BaseGameRecoveryInfo===undefined&&remaining>0&&extra===0&&trigger===freeWin&&base===current&&r.freeSpin==='Y'&&r.bonusAwarded==='Y','AG integrity: SG 88 Fortunes free introduction');played=0;total=remaining;}
 else {assert(prior&&paid,'AG integrity: SG 88 Fortunes prior free state');keys(g.BaseGameRecoveryInfo,'GameResult');const recovered=g.BaseGameRecoveryInfo.GameResult;keys(recovered,'stake|creditBet|betMultiplier|waysCount|totalWin|betID|ReelResults');const paidJackpotIntro=list(paid.Feature).some((f:any)=>f.index==='2'&&f.name==='BG_FuBat_Jackpot');
 // Own SDK replaces this recovery display total with GameWinInfo.totalWagerWin.
 // A completed paid jackpot is not repeated in the recovered reel display.
 for(const k of Object.keys(recovered)) {
  if(k==='totalWin'&&paidJackpotIntro)assert(recovered.totalWin===paid.totalWin||recovered.totalWin===paid.ReelResults.ReelSpin.totalSpinWin,'AG integrity: SG 88 Fortunes recovery display components changed');
  else assert(JSON.stringify(recovered[k])===JSON.stringify(paid[k]),'AG integrity: SG 88 Fortunes paid recovery changed');
 }assert(base===integer(paid.GameWinInfo.totalBaseGameWin,'88 recovered base')&&remaining===prior.freeSpinsRemaining-1+extra&&win===priorWin+current&&(extra>0)===(trigger>0),'AG integrity: SG 88 Fortunes free budget/money delta');played=prior.freeSpinsPlayed+1;total=prior.freeSpinsTotal+extra;assert(r.freeSpin===(extra>0?'Y':'N')&&r.bonusAwarded===(extra>0||freeJackpot?'Y':'N'),'AG integrity: SG 88 Fortunes retrigger/jackpot flags');}
 assert(played+remaining===total&&Number.isSafeInteger(total),'AG integrity: SG 88 Fortunes total budget');return {win,free:{freeSpinsTotal:total,freeSpinsPlayed:played,freeSpinsRemaining:remaining,accumulativeWin:win/100}};
}

export function validateFireQueenPaidData(game:AGGameConfig,g:any):number {
 assert(game.gameId==='32767'&&game.dbName==='sg_fire_queen'&&game.sg?.runtimeGameId===32989&&game.sg?.header?.gameID==='20192'&&game.sg?.header?.gameCodeRGI==='firequeen_prt'&&game.sg?.logicRequestNode==='WagerInfo'&&game.sg?.fireQueenPaidContract==='fire-queen-own-paid-v1'&&game.sg?.betRaw===50,'AG integrity: SG Fire Queen binding');
 const keys=(v:any,n:string)=>assert(v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join('|')===n.split('|').sort().join('|'),'AG integrity: SG Fire Queen schema');
 keys(g,'ReelResults|GameWinInfo|GameVariantInfo|stake|stakePerLine|paylineCount|totalWin|betID'+(g.WildTransformedReels!==undefined?'|WildTransformedReels':''));keys(g.ReelResults,'ReelSpin|numSpins');keys(g.GameWinInfo,'totalWagerWin|totalBGWin|totalFSWin|maxWinValue|isMaxWin|isEndGame');keys(g.GameVariantInfo,'rtp');
 assert(g.stake==='50'&&g.stakePerLine==='1'&&g.paylineCount==='100'&&g.GameVariantInfo.rtp==='95.95','AG integrity: SG Fire Queen wager');
 assert(g.GameWinInfo.isMaxWin==='N'&&g.GameWinInfo.isEndGame==='Y'&&g.GameWinInfo.totalFSWin==='0'&&g.GameWinInfo.maxWinValue==='25000000','AG integrity: SG Fire Queen actual feature requires mapping');
 const spins=list(g.ReelResults.ReelSpin);assert(g.ReelResults.numSpins==='1'&&spins.length===1,'AG integrity: SG Fire Queen spin count');const r=spins[0];
 keys(r,'ReelStops|spinIndex|reelsetIndex|winCountPL|winCountSC|spinWins|freeSpin|bonusAwarded'+(r.PaylineWin?'|PaylineWin':''));
 integer(r.reelsetIndex,'Fire Queen reel set');assert(r.spinIndex==='0'&&r.freeSpin==='N'&&r.bonusAwarded==='N'&&r.winCountSC==='0','AG integrity: SG Fire Queen unclassified feature');
 assert(typeof r.ReelStops==='string'&&/^\d+(?:\|\d+)*$/.test(r.ReelStops),'AG integrity: SG Fire Queen reel stops');r.ReelStops.split('|').forEach((v:string)=>integer(v,'Fire Queen reel stop'));
 // Client parser consumes this paid-spin display list without another wager.
 if(g.WildTransformedReels!==undefined){
  assert(typeof g.WildTransformedReels==='string'&&(g.WildTransformedReels===''||/^\d+\|\d+(?:,\d+\|\d+)*$/.test(g.WildTransformedReels)),'AG integrity: SG Fire Queen transformed reel schema');
  const transformed=new Set<number>();
  for(const token of g.WildTransformedReels===''?[]:g.WildTransformedReels.split(',')){const [reel,symbol]=token.split('|').map((v:string)=>integer(v,'Fire Queen transformed display'));assert(reel<r.ReelStops.split('|').length&&!transformed.has(reel),'AG integrity: SG Fire Queen transformed reel range');transformed.add(reel);}
 }
 const wins=list(r.PaylineWin),seen=new Set<number>();assert(wins.length===integer(r.winCountPL,'Fire Queen line count'),'AG integrity: SG Fire Queen line count');let sum=0;
 for(const w of wins){keys(w,'#text|index|winVal|awardIndex|awardTableIndex');const i=integer(w.index,'Fire Queen line');assert(i<100&&!seen.has(i),'AG integrity: SG Fire Queen duplicate line');seen.add(i);integer(w.awardIndex,'Fire Queen award');integer(w.awardTableIndex,'Fire Queen award table');assert(typeof w['#text']==='string'&&/^\d+(?:\|\d+)*$/.test(w['#text']),'AG integrity: SG Fire Queen win positions');w['#text'].split('|').forEach((v:string)=>integer(v,'Fire Queen win position'));sum+=integer(w.winVal,'Fire Queen win');}
 assert(Number.isSafeInteger(sum)&&sum===integer(r.spinWins,'Fire Queen spin win')&&sum===integer(g.totalWin,'Fire Queen root win')&&sum===integer(g.GameWinInfo.totalBGWin,'Fire Queen paid win')&&sum===integer(g.GameWinInfo.totalWagerWin,'Fire Queen cumulative win'),'AG integrity: SG Fire Queen monetary components');return sum;
}

export function validateGoldenChiefPaidData(game:AGGameConfig,g:any):void {
 assert(game.gameId==='32771'&&game.dbName==='sg_golden_chief'&&game.sg?.runtimeGameId===32993&&game.sg?.header?.gameID==='20125'&&game.sg?.header?.gameCodeRGI==='goldenchief'&&game.sg?.betRaw===100&&['golden-chief-own-paid-v1','golden-chief-own-totem-v6'].includes(game.sg?.goldenChiefPaidContract),'AG integrity: SG Golden Chief binding');
 const known=new Set(['stake','stakePerLine','paylineCount','totalWin','betID','ReelResults','BGInfo','PaylineCountInfo','SymbolUpgrade','WildExpansion']);assert(g&&typeof g==='object'&&!Array.isArray(g)&&Object.keys(g).every(k=>known.has(k)),'AG integrity: SG Golden Chief unknown paid data');
 const keys=(v:any,names:string)=>assert(v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join('|')===names.split('|').sort().join('|'),'AG integrity: SG Golden Chief schema');
 const positions=(v:any,max:number)=>{assert(typeof v==='string'&&/^\d+(?:\|\d+)*$/.test(v),'AG integrity: SG Golden Chief positions');const a=v.split('|').map((s:string)=>integer(s,'Golden Chief position'));assert(new Set(a).size===a.length&&a.every((n:number)=>n<max),'AG integrity: SG Golden Chief positions');return a;};
 keys(g.BGInfo,'totalWagerWin|bgWinnings|baseGameSpinsRemaining|isBigBet|isMaxWin|chiefWin');
 assert(g.BGInfo.isBigBet==='0'&&g.BGInfo.isMaxWin==='0'&&g.BGInfo.chiefWin==='0'&&g.BGInfo.baseGameSpinsRemaining==='0'&&!g.FSInfo,'AG integrity: SG Golden Chief actual feature requires mapping');
 keys(g.PaylineCountInfo,'normalPaylineCount|bonusPaylineCount|activePaylineCount');
 const active=integer(g.PaylineCountInfo.activePaylineCount,'Golden Chief active paylines');
 assert(g.PaylineCountInfo.normalPaylineCount==='20'&&g.PaylineCountInfo.bonusPaylineCount==='100'&&[20,100].includes(active)&&integer(g.paylineCount,'Golden Chief paylines')===active&&g.stake==='100'&&g.stakePerLine==='5','AG integrity: SG Golden Chief paylines');
 keys(g.ReelResults,'numSpins|ReelSpin');assert(g.ReelResults.numSpins==='1','AG integrity: SG Golden Chief reel count');
 const spins=list(g.ReelResults.ReelSpin);assert(spins.length===1,'AG integrity: SG Golden Chief current spin');const spin=spins[0];
 assert(spin.spinIndex==='0'&&spin.reelsetIndex==='0'&&spin.freeSpin==='N'&&spin.bonusAwarded==='N'&&spin.winCountSC==='0'&&!spin.ScatterWin,'AG integrity: SG Golden Chief paid reel');
 const wins=list(spin.PaylineWin);assert(wins.length===integer(spin.winCountPL,'Golden Chief line count'),'AG integrity: SG Golden Chief line count');
 let sum=0;const indices=new Set<number>();for(const w of wins){const i=integer(w.index,'Golden Chief win index');assert(i<active&&!indices.has(i),'AG integrity: SG Golden Chief win index');indices.add(i);integer(w.awardIndex,'Golden Chief award');integer(w.awardTableIndex,'Golden Chief award table');positions(w['#text'],20);sum+=integer(w.winVal,'Golden Chief line win');}
 assert(Number.isSafeInteger(sum)&&sum===integer(spin.spinWins,'Golden Chief spin win')&&sum===integer(g.totalWin,'Golden Chief total win')&&sum===integer(g.BGInfo.bgWinnings,'Golden Chief base win')&&sum===integer(g.BGInfo.totalWagerWin,'Golden Chief cumulative win'),'AG integrity: SG Golden Chief money');
 if(g.WildExpansion){keys(g.WildExpansion,'originalWildPositions|wildReels');const a=positions(g.WildExpansion.originalWildPositions,20),b=positions(g.WildExpansion.wildReels,5);assert(active===100&&a.every(n=>b.includes(n%5))&&b.every(n=>a.some(p=>p%5===n)),'AG integrity: SG Golden Chief wild columns');}else assert(active===20,'AG integrity: SG Golden Chief unbound extra paylines');
 if(g.SymbolUpgrade){keys(g.SymbolUpgrade,'replacementSymbol|positions');assert(active===100&&game.sg.goldenChiefUpgradeContract==='golden-chief-own-init-symbol-upgrade-v7'&&JSON.stringify(game.sg.goldenChiefUpgradeSymbolIds)===JSON.stringify([0,1,2,3,4,5,6,7,8,9,10])&&game.sg.goldenChiefUpgradeSymbolIds.includes(integer(g.SymbolUpgrade.replacementSymbol,'Golden Init replacement symbol')),'AG integrity: SG Golden Chief upgrade');positions(g.SymbolUpgrade.positions,20);}
}


// Actual own HTTP200 paid trigger + client's collect encoder. This is a pending
// selection, never a complete captured round or a synthetic free-spin result.

export function validateGoldenChiefBoardExtras(game:AGGameConfig,g:any,freeHorizontalExpansion=false):number {
 assert(game.gameId==='32771'&&game.dbName==='sg_golden_chief'&&game.sg?.runtimeGameId===32993&&game.sg?.header?.gameID==='20125'&&game.sg?.header?.gameCodeRGI==='goldenchief','AG integrity: SG Golden board binding');
 const keys=(v:any,n:string)=>assert(v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join('|')===n.split('|').sort().join('|'),'AG integrity: SG Golden board schema');
 const pos=(v:any,max:number)=>{assert(typeof v==='string'&&/^\d+(?:\|\d+)*$/.test(v),'AG integrity: SG Golden board positions');const a=v.split('|').map((n:string)=>integer(n,'Golden board position'));assert(new Set(a).size===a.length&&a.every((n:number)=>n<max),'AG integrity: SG Golden board positions');return a;};
 keys(g.PaylineCountInfo,'normalPaylineCount|bonusPaylineCount|activePaylineCount');assert(g.PaylineCountInfo.normalPaylineCount==='20'&&g.PaylineCountInfo.bonusPaylineCount==='100','AG integrity: SG Golden Init board lines');const active=integer(g.PaylineCountInfo.activePaylineCount,'Golden board active');assert([20,100].includes(active),'AG integrity: SG Golden active lines');
 if(g.WildExpansion){keys(g.WildExpansion,'originalWildPositions|wildReels');const a=pos(g.WildExpansion.originalWildPositions,20),b=pos(g.WildExpansion.wildReels,5);assert(active===100&&a.every((n:number)=>b.includes(n%5))&&(freeHorizontalExpansion||b.every((n:number)=>a.some((p:number)=>p%5===n))),'AG integrity: SG Golden board wild columns');}else assert(active===20,'AG integrity: SG Golden missing expanded wild');
 if(g.SymbolUpgrade){keys(g.SymbolUpgrade,'replacementSymbol|positions');assert(active===100&&game.sg.goldenChiefUpgradeContract==='golden-chief-own-init-symbol-upgrade-v7'&&JSON.stringify(game.sg.goldenChiefUpgradeSymbolIds)===JSON.stringify([0,1,2,3,4,5,6,7,8,9,10])&&game.sg.goldenChiefUpgradeSymbolIds.includes(integer(g.SymbolUpgrade.replacementSymbol,'Golden own Init symbol')),'AG integrity: SG Golden board upgrade');pos(g.SymbolUpgrade.positions,20);}
 return active;
}

export function validateGoldenChiefGambleIntro(game:AGGameConfig,g:any):number {
 assert(game.gameId==='32771'&&game.dbName==='sg_golden_chief'&&game.sg?.runtimeGameId===32993&&game.sg?.header?.gameID==='20125'&&game.sg?.header?.gameCodeRGI==='goldenchief'&&game.sg?.betRaw===100&&game.sg?.goldenChiefPaidContract==='golden-chief-own-totem-v6','AG integrity: SG Golden Chief gamble binding');
 const keys=(v:any,names:string)=>assert(v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join('|')===names.split('|').sort().join('|'),'AG integrity: SG Golden Chief gamble schema');
 const active=validateGoldenChiefBoardExtras(game,g);keys(g,'stake|stakePerLine|paylineCount|totalWin|betID|ReelResults|BGInfo|PaylineCountInfo|BonusWheel|GambleInfo'+(g.WildExpansion?'|WildExpansion':'')+(g.SymbolUpgrade?'|SymbolUpgrade':''));
 keys(g.BGInfo,'totalWagerWin|bgWinnings|baseGameSpinsRemaining|isBigBet|isMaxWin|chiefWin');
 assert(g.BGInfo.baseGameSpinsRemaining==='0'&&g.BGInfo.isBigBet==='0'&&g.BGInfo.isMaxWin==='0'&&g.BGInfo.chiefWin==='0','AG integrity: SG Golden Chief alternate game');
 keys(g.PaylineCountInfo,'normalPaylineCount|bonusPaylineCount|activePaylineCount');
 assert(g.stake==='100'&&g.stakePerLine==='5'&&integer(g.paylineCount,'Golden current paylines')===active&&g.PaylineCountInfo.normalPaylineCount==='20'&&g.PaylineCountInfo.bonusPaylineCount==='100'&&integer(g.PaylineCountInfo.activePaylineCount,'Golden active')===active,'AG integrity: SG Golden Chief gamble stake');
 keys(g.BonusWheel,'stopPosition');keys(g.GambleInfo,'previousFSCount|currentFSCount');
 assert(JSON.stringify(game.sg.goldenChiefWheelStrip)==JSON.stringify([1,0,1,2,1,0,1,0,1,2,1,0])&&JSON.stringify(game.sg.goldenChiefGambleCounts)==JSON.stringify([0,5,10,15,20,25,30]),'AG integrity: SG Golden Chief own Init contract');
 const stop=integer(g.BonusWheel.stopPosition,'Golden Chief wheel stop'),count=integer(g.GambleInfo.currentFSCount,'Golden Chief pending free count');
 assert(stop<game.sg.goldenChiefWheelStrip.length&&game.sg.goldenChiefWheelStrip[stop]===0&&count>0&&game.sg.goldenChiefGambleCounts.includes(count)&&g.GambleInfo.previousFSCount==='-1','AG integrity: SG Golden Chief wheel selection');
 keys(g.ReelResults,'numSpins|ReelSpin');assert(g.ReelResults.numSpins==='1','AG integrity: SG Golden Chief trigger reel count');const spins=list(g.ReelResults.ReelSpin);assert(spins.length===1,'AG integrity: SG Golden Chief trigger spin');const spin=spins[0];
 assert(spin.spinIndex==='0'&&spin.reelsetIndex==='0'&&spin.freeSpin==='N'&&spin.bonusAwarded==='Y'&&spin.winCountSC==='1','AG integrity: SG Golden Chief trigger flags');
 const scatter=spin.ScatterWin;assert(scatter&&scatter.winVal==='0'&&scatter.awardIndex==='0','AG integrity: SG Golden Chief trigger scatter');
 const wins=list(spin.PaylineWin);assert(wins.length===integer(spin.winCountPL,'Golden Chief line count'),'AG integrity: SG Golden Chief trigger lines');let sum=0;const seen=new Set<number>();
 for(const w of wins){const i=integer(w.index,'Golden Chief line index');assert(i<active&&!seen.has(i),'AG integrity: SG Golden Chief trigger index');seen.add(i);sum+=integer(w.winVal,'Golden Chief line win');}
 assert(Number.isSafeInteger(sum)&&sum===integer(spin.spinWins,'Golden Chief spin winnings')&&sum===integer(g.totalWin,'Golden Chief trigger total')&&sum===integer(g.BGInfo.totalWagerWin,'Golden Chief trigger cumulative')&&sum===integer(g.BGInfo.bgWinnings,'Golden Chief trigger base'),'AG integrity: SG Golden Chief trigger money');return count;
}


export function validateGoldenChiefCollectConfirmation(game:AGGameConfig,g:any,pending:{count:number;stop:string;baseWin:number},paidReels:any):void {
 assert(game.gameId==='32771'&&game.dbName==='sg_golden_chief'&&game.sg?.goldenChiefPaidContract==='golden-chief-own-totem-v6','AG integrity: SG Golden Chief collect binding');
 const keys=(v:any,names:string)=>assert(v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join('|')===names.split('|').sort().join('|'),'AG integrity: SG Golden Chief collect schema');
 keys(g,'stake|stakePerLine|paylineCount|totalWin|betID|BaseGameRecoveryInfo|GambleInfo');keys(g.BaseGameRecoveryInfo,'ReelResults|BGInfo|PaylineCountInfo|BonusWheel'+(g.BaseGameRecoveryInfo.WildExpansion?'|WildExpansion':'')+(g.BaseGameRecoveryInfo.SymbolUpgrade?'|SymbolUpgrade':''));const base=g.BaseGameRecoveryInfo;keys(base.BGInfo,'totalWagerWin|bgWinnings|baseGameSpinsRemaining|isBigBet|isMaxWin');
 assert(pending&&paidReels&&g.stake==='100'&&g.stakePerLine==='5'&&g.paylineCount==='0'&&g.totalWin==='0','AG integrity: SG Golden Chief collect wager');
 assert(JSON.stringify(g.BaseGameRecoveryInfo.ReelResults)===JSON.stringify(paidReels),'AG integrity: SG Golden Chief paid recovery bytes');
 keys(g.GambleInfo,'previousFSCount|currentFSCount|gambleFinished');keys(base.BonusWheel,'stopPosition');
 assert(integer(g.GambleInfo.previousFSCount,'Golden Chief previous collect')===pending.count&&integer(g.GambleInfo.currentFSCount,'Golden Chief confirmed collect')===pending.count&&g.GambleInfo.gambleFinished==='1'&&base.BonusWheel.stopPosition===pending.stop,'AG integrity: SG Golden Chief collect transition');
 assert(integer(base.BGInfo.bgWinnings,'Golden Chief collect base')===pending.baseWin&&integer(base.BGInfo.totalWagerWin,'Golden Chief collect total')===pending.baseWin&&base.BGInfo.baseGameSpinsRemaining==='0'&&base.BGInfo.isBigBet==='0'&&base.BGInfo.isMaxWin==='0','AG integrity: SG Golden Chief collect money');
 validateGoldenChiefBoardExtras(game,base);keys(base.PaylineCountInfo,'normalPaylineCount|bonusPaylineCount|activePaylineCount');assert(base.PaylineCountInfo.normalPaylineCount==='20'&&base.PaylineCountInfo.bonusPaylineCount==='100'&&[20,100].includes(integer(base.PaylineCountInfo.activePaylineCount,'Golden recovered lines')),'AG integrity: SG Golden Chief collect paylines');
}


export function validateGoldenChiefCanyon(game:AGGameConfig,g:any):void {
 assert(game.gameId==='32771'&&game.dbName==='sg_golden_chief'&&game.sg?.runtimeGameId===32993&&game.sg?.header?.gameID==='20125'&&game.sg?.header?.gameCodeRGI==='goldenchief'&&game.sg?.goldenChiefPaidContract==='golden-chief-own-totem-v6','AG integrity: SG Golden Chief Canyon binding');
 const keys=(v:any,names:string)=>assert(v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join('|')===names.split('|').sort().join('|'),'AG integrity: SG Golden Chief Canyon schema');
 keys(g,'stake|stakePerLine|paylineCount|totalWin|betID|ReelResults|BGInfo|PaylineCountInfo|BonusWheel|CanyonBonus'+(g.WildExpansion?'|WildExpansion':'')+(g.SymbolUpgrade?'|SymbolUpgrade':''));keys(g.CanyonBonus,'canyonID|winAmount|steps');keys(g.BonusWheel,'stopPosition');keys(g.BGInfo,'totalWagerWin|bgWinnings|baseGameSpinsRemaining|isBigBet|isMaxWin|chiefWin');keys(g.PaylineCountInfo,'normalPaylineCount|bonusPaylineCount|activePaylineCount');
 const active=validateGoldenChiefBoardExtras(game,g);const stop=integer(g.BonusWheel.stopPosition,'Canyon wheel stop');assert(JSON.stringify(game.sg.goldenChiefWheelStrip)===JSON.stringify([1,0,1,2,1,0,1,0,1,2,1,0])&&stop<12&&game.sg.goldenChiefWheelStrip[stop]===2,'AG integrity: SG Golden Chief Canyon wheel');
 assert(g.stake==='100'&&g.stakePerLine==='5'&&integer(g.paylineCount,'Golden current paylines')===active&&g.PaylineCountInfo.normalPaylineCount==='20'&&g.PaylineCountInfo.bonusPaylineCount==='100'&&integer(g.PaylineCountInfo.activePaylineCount,'Golden active')===active&&g.BGInfo.baseGameSpinsRemaining==='0'&&g.BGInfo.isBigBet==='0'&&g.BGInfo.isMaxWin==='0'&&g.BGInfo.chiefWin==='0','AG integrity: SG Golden Chief Canyon wager');
 const canyon=integer(g.CanyonBonus.canyonID,'Canyon ID'),table=game.sg.goldenChiefCanyonPrizes2x;
 assert(game.sg.goldenChiefCanyonTrailContract==='golden-chief-own-init-canyon-trails-v12'&&Array.isArray(table)&&table.length===10&&table.every((row:any)=>Array.isArray(row)&&row.length===24&&row.every((p:any)=>Number.isSafeInteger(p)&&p>0))&&canyon<table.length,'AG integrity: SG Golden Chief Canyon Init path');
 const text=g.CanyonBonus.steps;assert(typeof text==='string'&&/^(?:[1-6]\|)+-(?:1|2)$/.test(text),'AG integrity: SG Golden Chief completed Canyon display steps');
 // SDK starts before the trail. Each positive wheel step advances one cell
 // at a time; either declared negative wheel segment leaves the position alone.
 let position=-1;for(const move of text.split('|').slice(0,-1)){position+=integer(move,'Canyon move');assert(position>=0&&position<table[canyon].length,'AG integrity: SG Golden Chief Canyon trail overflow');}
 const displayPrize=table[canyon][position]*game.sg.betRaw/2;
 assert(Number.isSafeInteger(displayPrize)&&displayPrize===integer(g.CanyonBonus.winAmount,'Canyon derived award'),'AG integrity: SG Golden Chief Canyon own Init payout');
 keys(g.ReelResults,'numSpins|ReelSpin');const spins=list(g.ReelResults.ReelSpin);assert(g.ReelResults.numSpins==='1'&&spins.length===1,'AG integrity: SG Golden Chief Canyon reel');const spin=spins[0];assert(spin.spinIndex==='0'&&spin.reelsetIndex==='0'&&spin.freeSpin==='N'&&spin.bonusAwarded==='Y'&&spin.winCountSC==='1'&&spin.ScatterWin?.winVal==='0'&&spin.ScatterWin?.awardIndex==='0','AG integrity: SG Golden Chief Canyon flags');
 const wins=list(spin.PaylineWin);assert(wins.length===integer(spin.winCountPL,'Canyon line count'),'AG integrity: SG Golden Chief Canyon lines');let lines=0;for(const w of wins)lines+=integer(w.winVal,'Canyon line win');const prize=integer(g.CanyonBonus.winAmount,'Canyon prize');assert(Number.isSafeInteger(lines+prize)&&lines===integer(spin.spinWins,'Canyon reel win')&&lines+prize===integer(g.totalWin,'Canyon total')&&lines+prize===integer(g.BGInfo.bgWinnings,'Canyon base')&&lines+prize===integer(g.BGInfo.totalWagerWin,'Canyon cumulative'),'AG integrity: SG Golden Chief Canyon monetary components');
}


export function validateGoldenChiefFree(game:AGGameConfig,g:any,prior:any,pending:any,paidReels:any,priorWin:number):number {
 assert(game.gameId==='32771'&&game.dbName==='sg_golden_chief'&&game.sg?.runtimeGameId===32993&&game.sg?.header?.gameID==='20125'&&game.sg?.header?.gameCodeRGI==='goldenchief'&&game.sg?.goldenChiefPaidContract==='golden-chief-own-totem-v6','AG integrity: SG Golden free binding');
 const keys=(v:any,names:string)=>assert(v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join('|')===names.split('|').sort().join('|'),'AG integrity: SG Golden free schema');
 keys(g,'stake|stakePerLine|paylineCount|totalWin|betID|ReelResults|BaseGameRecoveryInfo|PaylineCountInfo|FSInfo'+(g.WildExpansion?'|WildExpansion':'')+(g.SymbolUpgrade?'|SymbolUpgrade':''));
 keys(g.FSInfo,'fsWinnings|freeSpinsTotal|freeSpinNumber|freespinsAwarded|isMaxWin');keys(g.BaseGameRecoveryInfo,'ReelResults|BGInfo|PaylineCountInfo|BonusWheel'+(g.BaseGameRecoveryInfo.WildExpansion?'|WildExpansion':'')+(g.BaseGameRecoveryInfo.SymbolUpgrade?'|SymbolUpgrade':''));
 const b=g.BaseGameRecoveryInfo;keys(b.BGInfo,'totalWagerWin|bgWinnings|baseGameSpinsRemaining|isBigBet|isMaxWin|chiefWin');keys(b.BonusWheel,'stopPosition');
 assert(prior&&pending&&Number.isSafeInteger(priorWin)&&JSON.stringify(b.ReelResults)===JSON.stringify(paidReels),'AG integrity: SG Golden free recovery bytes');
 assert(game.sg.goldenChiefFreeContract==='golden-chief-own-free-state-v10','AG integrity: SG Golden free state contract');
 assert(integer(b.BGInfo.bgWinnings,'Golden recovered base')===pending.baseWin&&b.BonusWheel.stopPosition===pending.stop&&b.BGInfo.baseGameSpinsRemaining==='0'&&b.BGInfo.isBigBet==='0'&&b.BGInfo.isMaxWin==='0'&&b.BGInfo.chiefWin==='0','AG integrity: SG Golden free base state');
 // The client renders horizontal expansion from returned wildReels. A free
 // expansion can span columns without an original wild in each column.
 const active=validateGoldenChiefBoardExtras(game,g,true);validateGoldenChiefBoardExtras(game,b);
 assert(g.stake==='100'&&g.stakePerLine==='5'&&integer(g.paylineCount,'Golden current paylines')===active&&g.FSInfo.isMaxWin==='0','AG integrity: SG Golden free wager');
 const played=integer(g.FSInfo.freeSpinNumber,'Golden played'),total=integer(g.FSInfo.freeSpinsTotal,'Golden total'),awarded=integer(g.FSInfo.freespinsAwarded,'Golden awarded');
 assert(played===prior.freeSpinsPlayed+1&&total===prior.freeSpinsTotal+awarded&&played<=total,'AG integrity: SG Golden free transition');
 keys(g.ReelResults,'numSpins|ReelSpin');const spins=list(g.ReelResults.ReelSpin);assert(g.ReelResults.numSpins==='1'&&spins.length===1,'AG integrity: SG Golden free reel');const r=spins[0];
 assert(r.spinIndex==='0'&&integer(r.reelsetIndex,'Golden free Init set')>=5&&integer(r.reelsetIndex,'Golden free Init set')<=14&&r.freeSpin==='Y','AG integrity: SG Golden free flags');
 if(awarded>0){
  assert(r.bonusAwarded==='Y'&&r.winCountSC==='1','AG integrity: SG Golden retrigger flags');
  keys(r.ScatterWin,'#text|winVal|awardIndex');assert(r.ScatterWin.winVal==='0'&&r.ScatterWin.awardIndex==='0','AG integrity: SG Golden free scatter');
 }else assert(r.bonusAwarded==='N'&&r.winCountSC==='0'&&r.ScatterWin===undefined,'AG integrity: SG Golden non-retrigger flags');
 const wins=list(r.PaylineWin);assert(wins.length===integer(r.winCountPL,'Golden free line count'),'AG integrity: SG Golden free lines');let win=0;const seen=new Set<number>();
 for(const w of wins){const index=integer(w.index,'Golden line');assert(index<active&&!seen.has(index),'AG integrity: SG Golden duplicate line');seen.add(index);integer(w.awardIndex,'Golden award');integer(w.awardTableIndex,'Golden table');assert(typeof w['#text']==='string'&&/^\d+(?:\|\d+)*$/.test(w['#text'])&&w['#text'].split('|').every((v:string)=>integer(v,'Golden symbol position')<20),'AG integrity: SG Golden positions');win+=integer(w.winVal,'Golden line amount');}
 const freeWin=integer(g.FSInfo.fsWinnings,'Golden free winnings');assert(Number.isSafeInteger(win)&&win===integer(r.spinWins,'Golden spin amount')&&win===integer(g.totalWin,'Golden current total')&&pending.baseWin+freeWin===priorWin+win,'AG integrity: SG Golden free monetary components');
 assert(Number.isSafeInteger(pending.baseWin+freeWin)&&integer(b.BGInfo.totalWagerWin,'Golden recovered cumulative wager')===pending.baseWin+freeWin,'AG integrity: SG Golden cumulative recovery money');return pending.baseWin+freeWin;
}


export function validateGoldenChiefTotem(game:AGGameConfig,g:any):void {
 assert(game.gameId==='32771'&&game.dbName==='sg_golden_chief'&&game.sg?.runtimeGameId===32993&&game.sg?.header?.gameID==='20125'&&game.sg?.header?.gameCodeRGI==='goldenchief'&&game.sg?.goldenChiefPaidContract==='golden-chief-own-totem-v6','AG integrity: SG Golden Totem binding');
 const keys=(v:any,names:string)=>assert(v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join('|')===names.split('|').sort().join('|'),'AG integrity: SG Golden Totem schema');
 keys(g,'stake|stakePerLine|paylineCount|totalWin|betID|ReelResults|BGInfo|PaylineCountInfo|BonusWheel|TotemBonus'+(g.WildExpansion?'|WildExpansion':'')+(g.SymbolUpgrade?'|SymbolUpgrade':''));keys(g.TotemBonus,'gameMode|totemType|numLives|winAmount|steps');keys(g.BonusWheel,'stopPosition');keys(g.BGInfo,'totalWagerWin|bgWinnings|baseGameSpinsRemaining|isBigBet|isMaxWin|chiefWin');keys(g.PaylineCountInfo,'normalPaylineCount|bonusPaylineCount|activePaylineCount');
 const active=validateGoldenChiefBoardExtras(game,g);const stop=integer(g.BonusWheel.stopPosition,'Totem wheel stop');assert(stop<12&&game.sg.goldenChiefWheelStrip[stop]===1&&JSON.stringify(game.sg.goldenChiefWheelStrip)===JSON.stringify([1,0,1,2,1,0,1,0,1,2,1,0]),'AG integrity: SG Golden Totem wheel');
 assert(g.stake==='100'&&g.stakePerLine==='5'&&integer(g.paylineCount,'Golden current paylines')===active&&g.PaylineCountInfo.normalPaylineCount==='20'&&g.PaylineCountInfo.bonusPaylineCount==='100'&&integer(g.PaylineCountInfo.activePaylineCount,'Golden active')===active&&g.BGInfo.baseGameSpinsRemaining==='0'&&g.BGInfo.isBigBet==='0'&&g.BGInfo.isMaxWin==='0'&&g.BGInfo.chiefWin==='0','AG integrity: SG Golden Totem wager');
 assert(game.sg.goldenChiefTotemLifeContract==='golden-chief-own-init-trails-lives-v11'&&g.TotemBonus.gameMode==='1'&&['0','1'].includes(g.TotemBonus.totemType)&&typeof g.TotemBonus.steps==='string'&&/^(?:[012]|-2)(?:\|(?:[012]|-2))*$/.test(g.TotemBonus.steps),'AG integrity: SG Golden completed Totem display scope');
 const trails=game.sg.goldenChiefTotemTrails?.[g.TotemBonus.totemType],lives=integer(g.TotemBonus.numLives,'Totem extra lives');
 assert(Array.isArray(trails)&&trails.length===3&&trails.every((a:any)=>Array.isArray(a)&&a.length===15&&a.every((v:any)=>Number.isSafeInteger(v)&&v>=0))&&lives<=2,'AG integrity: SG Golden own Init Totem trail/life bounds');
 const picks=g.TotemBonus.steps.split('|').map(Number);let position=-1,spent=0,displayWin=0,terminal=false;
 for(let i=0;i<picks.length;i++){
  const pick=picks[i];assert(!terminal,'AG integrity: SG Golden Totem data after terminal');
  if(i===0||picks[i-1]>=0)position++;
  assert(position>=0&&position<trails[0].length,'AG integrity: SG Golden Totem trail position');
  if(pick<0){assert(i>0&&++spent<=lives,'AG integrity: SG Golden Totem life budget');}
  else if(pick===2&&i>0)terminal=true;
  else {displayWin=trails[pick][position]*game.sg.betRaw;assert(Number.isSafeInteger(displayWin),'AG integrity: SG Golden Totem prize overflow');terminal=position===trails[pick].length-1;}
 }
 assert(terminal&&displayWin===integer(g.TotemBonus.winAmount,'Totem declared prize'),'AG integrity: SG Golden Totem Init-derived prize');
 keys(g.ReelResults,'numSpins|ReelSpin');const spins=list(g.ReelResults.ReelSpin);assert(g.ReelResults.numSpins==='1'&&spins.length===1,'AG integrity: SG Golden Totem reel');const r=spins[0];assert(r.spinIndex==='0'&&r.reelsetIndex==='0'&&r.freeSpin==='N'&&r.bonusAwarded==='Y'&&r.winCountSC==='1'&&r.ScatterWin?.winVal==='0'&&r.ScatterWin?.awardIndex==='0','AG integrity: SG Golden Totem flags');
 const wins=list(r.PaylineWin);assert(wins.length===integer(r.winCountPL,'Totem line count'),'AG integrity: SG Golden Totem lines');let sum=0;const seen=new Set<number>();for(const w of wins){const i=integer(w.index,'Totem line');assert(i<active&&!seen.has(i),'AG integrity: SG Golden Totem line index');seen.add(i);sum+=integer(w.winVal,'Totem line win');}const prize=integer(g.TotemBonus.winAmount,'Totem prize');assert(Number.isSafeInteger(sum+prize)&&sum===integer(r.spinWins,'Totem spin money')&&sum+prize===integer(g.totalWin,'Totem total')&&sum+prize===integer(g.BGInfo.bgWinnings,'Totem base')&&sum+prize===integer(g.BGInfo.totalWagerWin,'Totem cumulative'),'AG integrity: SG Golden Totem monetary components');
}

export function validateDragonWildInfo(game: AGGameConfig, result: any): void {
    assert(game.gameId === '32764' && game.dbName === 'sg_dragon_spin'
        && game.sg?.runtimeGameId === 32986 && game.sg?.runtimeSlug === 'dragon-spin'
        && game.sg?.header?.gameCodeRGI === 'dragonspin' && game.sg?.header?.gameID === '20117'
        && game.sg?.wildPositionContract === 'dragon-5x3-positions-v1', 'AG integrity: SG Dragon wild binding');
    const feature = integer(result.FSInfo?.featureIndex, 'Dragon wild feature');
    assert(feature === 1 || feature === 2, 'AG integrity: SG Dragon wild feature not mapped');
    const allowed = feature === 1 ? ['WildPos'] : ['NewWildPos', 'OldWildPos'];
    const wild = result.WildInfo === '' ? {} : result.WildInfo;
    assert(wild && typeof wild === 'object' && !Array.isArray(wild)
        && Object.keys(wild).every(key => allowed.includes(key)), 'AG integrity: SG Dragon wild schema');
    const seen = new Set<number>();
    for (const key of Object.keys(wild)) {
        const text = wild[key];
        assert(typeof text === 'string' && (text === '' || /^(?:0|[1-9]\d*)(?:\|(?:0|[1-9]\d*))*$/.test(text)),
            'AG integrity: SG Dragon wild positions');
        for (const value of text === '' ? [] : text.split('|')) {
            const position = integer(value, 'Dragon wild position');
            assert(position < 15 && !seen.has(position), 'AG integrity: SG Dragon wild board position');
            seen.add(position);
        }
    }
}

// Himalaya's exact frontend sends the same Logic request while existing
// free counters have remaining spins. Compass animation uses the already
// returned result. Winning/fully charged branches need their own mapped data.
export function validateHimalayaCompass(game:AGGameConfig,result:any,previousFree?:Record<string,any>):void {
    assert(game.gameId==='32774' && game.dbName==='sg_himalayas_roof_of_the_world'
        && game.sg?.header?.gameCodeRGI==='himalayas' && game.sg?.header?.gameID==='20230'
        && game.sg?.runtimeGameId===32996 && game.sg?.runtimeSlug==='himalayas--roof-of-the-world'
        && game.sg?.compassContract==='himalaya-existing-free-compass-v4','AG integrity: SG Himalaya compass binding');
    const c=result.Compass,f=result.FSInfo;
    assert(c&&typeof c==='object'&&!Array.isArray(c)&&Object.keys(c).sort().join('|')==='compasPiecesFoundThisSpin|percentFull|pickChoices|pickValueAward|wonGamble','AG integrity: SG Himalaya compass schema');
    const percent=integer(c.percentFull,'Himalaya compass percent'),pieces=integer(c.compasPiecesFoundThisSpin,'Himalaya compass pieces');
    assert(percent<=100&&percent%20===0&&pieces<=4,'AG integrity: SG Himalaya compass geometry');
    assert(c.pickChoices==='5|7|10|12|20','AG integrity: SG Himalaya award choices changed');
    assert(f&&integer(f.freeSpinNumber,'Himalaya played')<=integer(f.freeSpinsTotal,'Himalaya total'),'AG integrity: SG Himalaya missing free counters');
    const remaining=integer(f.freeSpinsTotal,'Himalaya total')-integer(f.freeSpinNumber,'Himalaya played');
    // Exact own SDK getBoolean maps -1 and 0 to false, 1 to true.
    // Permit only the observed pending branch and the SDK's losing terminal.
    const pending=remaining>0&&c.wonGamble==='-1'&&c.pickValueAward==='-1'&&percent<=80;
    const lost=remaining===0&&c.wonGamble==='0'&&c.pickValueAward==='-2'&&percent<=80;
    // The exact SDK consumes the returned Compass award and continues Logic;
    // Group-end awards and fully charged mid-group awards were returned naturally.
    // The latter preserves unplayed old spins and adds the returned award once.
    // No pick HTTP request is sent, no free counters or money are invented.
    let won=false;
    if(c.wonGamble==='1') {
        const award=integer(c.pickValueAward,'Himalaya awarded free spins');
        const played=integer(f.freeSpinNumber,'Himalaya awarded played'),total=integer(f.freeSpinsTotal,'Himalaya awarded total');
        won=!!previousFree&&[5,7,10,12,20].includes(award)
            &&played===previousFree.freeSpinsPlayed+1&&played<=previousFree.freeSpinsTotal
            &&(played===previousFree.freeSpinsTotal||percent===100)
            &&total===previousFree.freeSpinsTotal+award
            &&remaining===previousFree.freeSpinsTotal-played+award;
    }
    assert(pending||lost||won,'AG integrity: SG Himalaya compass transition not mapped');
    assert(integer(result.BGInfo.baseGameSpinsRemaining,'Himalaya base remaining')===0,'AG integrity: SG Himalaya base continuation not mapped');
}

// Shared returned-cash decoder, bound to these three independently evidenced
// connections. It translates SG data; original AG still controls every action.
function ownHealthyComponentsBinding(game:AGGameConfig):'megaways'|'deepsea'|'jinji'|'spartacus' {
 const bindings:any={
  '32807':['sg_spartacusmegaways',33167,'20405','spartacusmegaways',200,'spartacus-own-returned-components-v1','spartacus'],
  '32751':['sg_eightyeightfortunesmegaways',32973,'20371','eightyeightfortunesmegaways',16,'eighty-eight-megaways-own-components-v3','megaways'],
  '32765':['sg_dropandlockdeepseamagic',32987,'20412','dropandlockdeepseamagic',200,'deep-sea-own-line-free-components-v1','deepsea'],
  '32777':['sg_jjbxmegaways',32999,'20468','jjbxmegaways',88,'jin-ji-megaways-own-paid-components-v1','jinji']
 };
 const b=bindings[game.gameId];assert(b&&game.dbName===b[0]&&game.sg.runtimeGameId===b[1]&&game.sg.header.gameID===b[2]&&game.sg.header.gameCodeRGI===b[3]&&game.sg.betRaw===b[4]&&game.sg.healthyComponentsContract===b[5],'AG integrity: SG healthy component connection');return b[6];
}
function ownHealthyTopReel(top:any,kind?:string) {
 ownPaidKeys(top,'reelSetIndex|reelStop|positions','healthy top reel');integer(top.reelSetIndex,'top set');integer(top.reelStop,'top stop');
 assert(JSON.stringify(ownPositionNumbers(top.positions,4,'top positions'))===JSON.stringify(kind==='spartacus'?[55,56,57,58]:[37,38,39,40]),'AG integrity: SG top positions');
}
function ownHealthyReelCash(reels:any,kind:string,isFree:boolean,hasIntro:boolean):number {
 ownPaidKeys(reels,'numSpins|ReelSpin'+(kind==='spartacus'?'|CurtainInfo':''),'healthy reels');const spins=list(reels.ReelSpin);
 assert(spins.length===integer(reels.numSpins,'healthy cascade count')&&spins.length>0,'AG integrity: SG healthy cascade count');
 if(kind==='spartacus'){
  const curtains=list(reels.CurtainInfo);assert(curtains.length===spins.length,'AG integrity: SG Spartacus paired curtains');
  for(const [i,c] of curtains.entries()){ownPaidKeys(c,'spinIndex|heights','Spartacus curtain');assert(integer(c.spinIndex,'Spartacus curtain index')===i&&ownPositionNumbers(c.heights,6,'Spartacus curtain heights').every(n=>n<=10),'AG integrity: SG Spartacus curtain geometry');}
 }
 let cash=0;
 for(const [i,s] of spins.entries()) {
  const deep=kind==='deepsea',wins=list(deep?s.PaylineWin:s.AnywayWin),scatters=list(s.ScatterWin);
  const names=deep?'spinIndex|reelsetIndex|winCountPL|winCountSC|spinWins|freeSpin|bonusAwarded|ReelStops':'spinIndex|reelsetIndex|anywayWins|scatterWinCount|totalSpinWin|freeSpin|bonusAwarded|ReelStops';
  ownPaidKeys(s,names+(wins.length?(deep?'|PaylineWin':'|AnywayWin'):'')+(scatters.length?'|ScatterWin':''),'healthy reel spin');
  assert(integer(s.spinIndex,'healthy spin index')===i&&s.freeSpin===(isFree?'Y':'N')&&['Y','N'].includes(s.bonusAwarded),'AG integrity: SG healthy spin state');
  assert(hasIntro||s.bonusAwarded==='N','AG integrity: SG healthy unmapped bonus');integer(s.reelsetIndex,'healthy reel set');ownPositionNumbers(s.ReelStops,deep?5:6,'healthy reel stops');
  assert(integer(deep?s.winCountPL:s.anywayWins,'healthy ways count')===wins.length&&integer(deep?s.winCountSC:s.scatterWinCount,'healthy scatter count')===scatters.length,'AG integrity: SG healthy award count');
  let lines=0,scatter=0;
  for(const [j,w] of wins.entries()) {
   ownPaidKeys(w,deep?'index|winVal|awardIndex|awardTableIndex|#text':'winIndex|winVal|ways|awardIndex|#text','healthy cash award');
   if(deep){assert(integer(w.index,'payline index')<50,'AG integrity: SG payline index');integer(w.awardTableIndex,'award table');}
   else assert(integer(w.winIndex,'ways index')===j&&integer(w.ways,'ways')>0,'AG integrity: SG ways index');
   integer(w.awardIndex,'healthy award index');assert(ownPositionNumbers(w['#text'],undefined,'healthy winning positions').every(n=>n<(deep?15:kind==='spartacus'?6*10:kind==='megaways'?6*7:41)),'AG integrity: SG healthy position range');lines+=integer(w.winVal,'healthy line cash');
  }
  for(const w of scatters) {
   ownPaidKeys(w,'winVal|awardIndex'+(w['#text']!==undefined?'|#text':''),'healthy scatter');integer(w.awardIndex,'scatter award');
   if(w['#text']!==undefined)assert(ownPositionNumbers(w['#text'],undefined,'scatter positions').every(n=>n<(deep?15:kind==='spartacus'?6*10:kind==='megaways'?6*7:41)),'AG integrity: SG scatter range');scatter+=integer(w.winVal,'scatter cash');
  }
  assert(lines===integer(deep?s.spinWins:s.totalSpinWin,'healthy returned line cash'),'AG integrity: SG healthy line cash disagreement');cash+=lines+scatter;assert(Number.isSafeInteger(cash),'AG integrity: SG unsafe healthy cash');
 }
 return cash;
}
export function validateOwnHealthyComponents(game:AGGameConfig,g:any,first:boolean,previousFree:any,base:any,previousWin:number) {
 const kind=ownHealthyComponentsBinding(game),deep=kind==='deepsea',hasFree=g?.FSInfo!==undefined;
 assert(first||kind!=='jinji','AG integrity: SG Jin Ji new free branch needs own evidence');
 const names='stake|totalWin|betID|ReelResults|BGInfo'+(deep?'|stakePerLine|paylineCount':'|TopReelInfo')+(g?.BonusSymValues!==undefined?'|BonusSymValues':'')+(hasFree?'|FSInfo':'')+(g?.PickerInfo!==undefined?'|PickerInfo':'')+(!first?'|BaseGameRecoveryInfo'+(deep?'|MultiplierInfo':'|CascadeInfo'):'');
 ownPaidKeys(g,names,'healthy component result');assert(integer(g.stake,'healthy stake')===game.sg.betRaw&&typeof g.betID==='string','AG integrity: SG healthy wager');
 if(deep)assert(g.stakePerLine==='4'&&g.paylineCount==='50','AG integrity: SG Deep Sea wager');else ownHealthyTopReel(g.TopReelInfo,kind);
 if(g.BonusSymValues!==undefined){assert(deep&&typeof g.BonusSymValues==='string'&&/^(?:-1|\d+)(?:\|(?:-1|\d+))*$/.test(g.BonusSymValues),'AG integrity: SG Deep Sea bonus display');const vals=g.BonusSymValues.split('|');assert(vals.length===15&&vals.every((v:string)=>v==='-1'||Number.isSafeInteger(Number(v))),'AG integrity: SG Deep Sea display geometry');}
 ownPaidKeys(g.BGInfo,'totalWagerWin|bgWinnings|isMaxWin'+(deep?'':kind==='megaways'?'|gameMode|reelHeights':'|reelHeights'),'healthy base info');assert(g.BGInfo.isMaxWin==='0','AG integrity: SG healthy capped result');
 if(kind==='megaways')assert(g.BGInfo.gameMode==='0','AG integrity: SG 88 game mode');
 if(!deep)assert(ownPositionNumbers(g.BGInfo.reelHeights,6,'base reel heights').every(n=>n>=2&&n<=(kind==='spartacus'?10:7)),'AG integrity: SG base heights');
 const current=ownHealthyReelCash(g.ReelResults,kind,!first,first&&hasFree),win=integer(g.BGInfo.totalWagerWin,'healthy cumulative'),bg=integer(g.BGInfo.bgWinnings,'healthy paid cash');
 assert(integer(g.totalWin,'healthy current cash')===current&&win===(first?current:previousWin+current),'AG integrity: SG healthy current cumulative cash');
 if(first){assert(bg===current&&previousFree===undefined,'AG integrity: SG healthy paid entry');base=structuredClone(g);}
 else {
  assert(previousFree&&base&&hasFree&&bg===integer(base.BGInfo.bgWinnings,'original paid cash'),'AG integrity: SG healthy free entry retained');
  ownPaidKeys(g.BaseGameRecoveryInfo,deep?'ReelResults':'ReelResults|TopReelInfo','healthy paid recovery');assert(JSON.stringify(g.BaseGameRecoveryInfo.ReelResults)===JSON.stringify(base.ReelResults),'AG integrity: SG healthy original reels changed');
  if(!deep){assert(JSON.stringify(g.BaseGameRecoveryInfo.TopReelInfo)===JSON.stringify(base.TopReelInfo)&&g.BGInfo.reelHeights===base.BGInfo.reelHeights,'AG integrity: SG healthy paid top/height recovery');}
  if(deep){ownPaidKeys(g.MultiplierInfo,'currentMultiplier|multList','Deep Sea multiplier');const mult=integer(g.MultiplierInfo.currentMultiplier,'Deep Sea multiplier');assert(mult>0&&ownPositionNumbers(g.MultiplierInfo.multList,undefined,'Deep Sea multiplier list').includes(mult),'AG integrity: SG Deep Sea multiplier display');}
 }
 if(!hasFree){assert(first&&g.PickerInfo===undefined&&bg===win,'AG integrity: SG healthy free state disappeared');return {win,free:undefined,base};}
 assert(kind!=='jinji','AG integrity: SG Jin Ji free scope not evidenced');
 const f=g.FSInfo;ownPaidKeys(f,first?(deep?'fsWinnings|freeSpinsTotal|freeSpinNumber':kind==='spartacus'?'fsWinnings|freeSpinsTotal|freeSpinNumber|extraSpinsAwarded|curtainIndex'+(g.FSInfo.startCasMult!==undefined?'|startCasMult':''):'fsWinnings|freeSpinsTotal|freeSpinNumber|isMaxWin|startCasMult'):(deep?'fsWinnings|freeSpinsTotal|freeSpinNumber|isMaxWin|extraSpinsAwarded':'fsWinnings|freeSpinsTotal|freeSpinNumber|extraSpinsAwarded|reelHeights'),'healthy free info');
 const total=integer(f.freeSpinsTotal,'healthy free total'),played=integer(f.freeSpinNumber,'healthy free played'),freeWin=integer(f.fsWinnings,'healthy free cash');assert(total>0&&played<=total&&bg+freeWin===win,'AG integrity: SG healthy free components');
 if(f.isMaxWin!==undefined)assert(f.isMaxWin==='0','AG integrity: SG healthy free cap');
 if(first){assert(played===0&&freeWin===0,'AG integrity: SG healthy free intro');if(kind==='spartacus'){assert(g.PickerInfo===undefined&&integer(f.extraSpinsAwarded,'Spartacus paid free award')===0&&JSON.stringify(game.sg.spartacusCurtainIndices)===JSON.stringify([0,1,2,3,4,5])&&game.sg.spartacusCurtainIndices.includes(integer(f.curtainIndex,'Spartacus returned curtain')),'AG integrity: SG Spartacus free introduction');if(f.startCasMult!==undefined)assert(integer(f.startCasMult,'Spartacus initial multiplier')>0,'AG integrity: SG Spartacus initial multiplier');}else if(!deep){if(g.PickerInfo!==undefined){ownPaidKeys(g.PickerInfo,'pickerIndex','88 picker display');integer(g.PickerInfo.pickerIndex,'88 returned picker index');}assert(integer(f.startCasMult,'88 initial multiplier')>0,'AG integrity: SG 88 server free introduction');}}
 else {
  const award=integer(f.extraSpinsAwarded,'healthy awarded extra spins');assert(played===previousFree.freeSpinsPlayed+1&&total===previousFree.freeSpinsTotal+award,'AG integrity: SG healthy free counter transition');
  if(!deep){assert(g.PickerInfo===undefined&&ownPositionNumbers(f.reelHeights,6,'free heights').every(n=>n>=2&&n<=(kind==='spartacus'?10:7)),'AG integrity: SG healthy free heights');ownPaidKeys(g.CascadeInfo,'prevCascadeMult|curCascadeMult','88 cascade multiplier');const prior=integer(g.CascadeInfo.prevCascadeMult,'88 prior multiplier'),next=integer(g.CascadeInfo.curCascadeMult,'88 current multiplier');assert(prior===(previousFree.ownCascadeMultiplier??(kind==='spartacus'&&base.FSInfo.startCasMult===undefined?1:integer(base.FSInfo.startCasMult,'own initial multiplier')))&&next===prior+list(g.ReelResults.ReelSpin).length-1,'AG integrity: SG 88 cascade transition');}
 }
 return {win,base,free:{freeSpinsTotal:total,freeSpinsPlayed:played,freeSpinsRemaining:total-played,accumulativeWin:win/100,...(['megaways','spartacus'].includes(kind)?{ownCascadeMultiplier:first?(kind==='spartacus'&&f.startCasMult===undefined?1:integer(f.startCasMult,'own initial multiplier')):integer(g.CascadeInfo.curCascadeMult,'own current multiplier')}:{})}};
}

export function sgRequestTimeoutMs(game: AGGameConfig): number {
    const value=game.sg?.requestTimeoutMs === undefined ? 30000 : game.sg.requestTimeoutMs;
    assert(Number.isSafeInteger(value) && value>=1000 && value<=120000,'AG integrity: SG request timeout binding');
    return value;
}
export function sgTransportDiagnostic(error: unknown, start: number, deadline: number, now=Date.now(), responseStatus?: number) {
    const e=error && typeof error==='object' ? error as any : undefined;
    const safeName=(v:unknown)=>typeof v==='string' && /^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(v) ? v : undefined;
    const safeCode=(v:unknown)=>typeof v==='string' && /^[A-Z][A-Z0-9_]{0,63}$/.test(v) ? v : undefined;
    const elapsed=Number.isSafeInteger(start)&&Number.isSafeInteger(now)&&now>=start ? now-start : undefined;
    return {errorName:safeName(e?.name),causeName:safeName(e?.cause?.name),causeCode:safeCode(e?.cause?.code),
        elapsedMs:elapsed,configuredTimeoutMs:deadline,
        responseHeadersReceived:responseStatus!==undefined,
        ...(responseStatus!==undefined ? {responseStatusBeforeBodyFailed:responseStatus} : {}),
        completeResponseCaptured:false,serverApplicationOutcomeProven:false};
}

export class SGWmsSession {
    private balance = Number.NaN;
    private startBalance = Number.NaN;
    private totalWin = 0;
    private free: Record<string, any> | undefined;
    private action = 'SPIN';
    private goldenPending: {count:number;stop:string;baseWin:number} | undefined;
    private steps: WireStep[] = [];
    private readonly freshFreeId = 'Free:' + crypto.randomBytes(16).toString('hex');
    private session = this.freshFreeId;
    private closed = false;
    private lastRequest: {event:string;parameters:Record<string,any>|null} | undefined;
    private lastBase: unknown;
    private eightyBase: unknown;
    private coolJewelsBase:any;
    private fudaBase: unknown;
    private healthyComponentsBase:any;
    private journal: number | null = null;
    private journalPath: string | null = null;
    private ordinal = 0;
    private cookies = new Map<string,string>();
    private gameplayRequestHasBeenSent = false;
    constructor(private readonly game: AGGameConfig, private readonly transport?: WireTransport, initialBalance?: number) {
        assert(game.provider === 'sg' && game.sg?.protocol === 'wms', 'AG integrity: SG protocol adapter unavailable');
        assert(game.sg.endpoint === 'https://gls.atc.casinarena.com/gls.rgsx', 'AG integrity: SG endpoint');
        assert(String(game.sg.header?.gameCodeRGI).length > 0 && /^\d+$/.test(String(game.sg.header?.gameID)), 'AG integrity: SG game binding');
        assert(Number.isSafeInteger(game.sg.betRaw) && game.sg.betRaw > 0, 'AG integrity: SG wager binding');
        if(initialBalance !== undefined) { assert(Number.isSafeInteger(initialBalance)); this.balance=initialBalance; }
    }
    private evidence(value: Record<string,unknown>) {
        if(this.transport) return; // offline transport keeps its own supplied evidence
        if(this.journal === null) {
            const dir=path.resolve(process.env.SG_EVIDENCE_DIR || '.sg-evidence');fs.mkdirSync(dir,{recursive:true});
            if(this.journalPath===null) {
                this.journalPath=path.join(dir,`${this.game.gameId}-${process.pid}-${crypto.randomUUID()}.jsonl`);
                this.journal=fs.openSync(this.journalPath,'wx',0o600);
            } else {
                // A response already in flight can finish after AG closes this session.
                // Keep it beside its original intent; closing never authorizes another request.
                this.journal=fs.openSync(this.journalPath,'a',0o600);
            }
        }
        fs.writeSync(this.journal, JSON.stringify({...value,at:new Date().toISOString()})+'\n');fs.fsyncSync(this.journal);
        if(this.closed) {fs.closeSync(this.journal);this.journal=null;}
    }
    async connect(): Promise<void> {
        if(this.transport) { assert(Number.isSafeInteger(this.balance));return; }
        assert(process.env.SG_AG_ALLOW_SOURCE === '1', 'AG integrity: SG live source not enabled');
        try {const response=await this.exchange('Init',{});const r=this.readEnvelope(response,'Init');
            if(this.game.sg.eightyFortunesContract){
                const pools:any[]=[];const walk=(v:any)=>{if(!v||typeof v!=='object')return;for(const [k,value] of Object.entries(v)){if(k==='ReelInfo')pools.push(value);else walk(value);}};walk(r);assert(pools.length===1,'AG integrity: SG 88 own Init reels missing');
                for(const [feature,expected] of [['0',this.game.sg.eightyFortunesBaseReels],['1',this.game.sg.eightyFortunesFreeReels]]){const sets=list(pools[0].ReelSet).filter((s:any)=>s.featIndex===feature);assert(sets.every((s:any)=>s.numReels==='5'),'AG integrity: SG 88 own Init geometry');const actual=sets.map((s:any)=>integer(s.reelSetIndex,'88 Init set')).sort((a:number,b:number)=>a-b);assert(JSON.stringify(actual)===JSON.stringify(expected),'AG integrity: SG 88 own Init declared sets changed');}
            }
            if(this.game.sg.goldenChiefCanyonTrailContract){
                const pools:any[]=[];const walk=(v:any)=>{if(!v||typeof v!=='object')return;for(const [k,value] of Object.entries(v)){if(k==='CashCanyons')pools.push(value);else walk(value);}};walk(r);
                assert(pools.length===1&&Object.keys(pools[0]).join('|')==='Canyon','AG integrity: SG Golden own Init Canyon table missing');
                const rows=list(pools[0].Canyon).sort((a:any,b:any)=>Number(a.canyonID)-Number(b.canyonID));
                assert(rows.length===10&&rows.every((p:any,i:number)=>p.canyonID===String(i)&&Object.keys(p).sort().join('|')==='canyonID|prizes'),'AG integrity: SG Golden own Init Canyon schema');
                const actual=rows.map((p:any)=>p.prizes.split('|').map((n:string)=>{assert(/^(?:0|[1-9]\d*)(?:\.[05])?$/.test(n),'AG integrity: SG Golden own Init Canyon half-unit');const v=Number(n)*2;assert(Number.isSafeInteger(v)&&v>0,'AG integrity: SG Golden own Init Canyon prize');return v;}));
                assert(JSON.stringify(actual)===JSON.stringify(this.game.sg.goldenChiefCanyonPrizes2x),'AG integrity: SG Golden own Init Canyon table changed');
            }
            if(this.game.sg.goldenChiefTotemLifeContract){
                const pools:any[]=[];const walk=(v:any)=>{if(!v||typeof v!=='object')return;for(const [k,value] of Object.entries(v)){if(k==='TotemPoles')pools.push(value);else walk(value);}};walk(r);
                assert(pools.length===1,'AG integrity: SG Golden own Init Totem data missing');
                for(const type of ['0','1']){const rows=list(pools[0].Pole).filter((p:any)=>p.gameMode==='1'&&p.totemType===type).sort((a:any,b:any)=>Number(a.id)-Number(b.id));assert(rows.length===3&&rows.every((p:any,i:number)=>p.id===String(i)&&Object.keys(p).sort().join('|')==='gameMode|id|prizes|totemType'),'AG integrity: SG Golden own Init Totem columns');const actual=rows.map((p:any)=>p.prizes.split('|').map((n:string)=>integer(n,'Totem Init prize')));assert(JSON.stringify(actual)===JSON.stringify(this.game.sg.goldenChiefTotemTrails[type]),'AG integrity: SG Golden own Init Totem trail changed');}
            }
        }
        catch(error) {this.close();throw error;}
    }
    getHandshakeData() { return null; } // no AG-format handshake is fabricated
    getBalance() { return this.balance/100; }
    getFallbackBet() { return this.game.sg.betRaw/100; }
    getSpinParams() { return {...this.game.sg.stake}; }
    getPickProtocol(action:string) {
        if(action!=='PICK_FREE_SPINS'||this.game.sg.goldenChiefPaidContract!=='golden-chief-own-totem-v6')return undefined;
        assert(this.game.gameId==='32771'&&this.game.dbName==='sg_golden_chief'&&this.action===action&&this.free?.freeSpinsPlayed===0&&this.free.freeSpinsTotal>0,'AG integrity: SG Golden Chief collect protocol scope');
        return {kind:'choice' as const,event:'Logic',options:[{pickIndex:1,requestPickIndex:1,requestParams:{__sgGoldenCollect:'1'}}]};
    }
    getPickParams(_index: number|string): never { throw new Error('AG integrity: SG pick protocol not mapped'); }
    getInitialRoundRequest() { return {event:'Logic',parameters:this.getSpinParams()}; }
    getLastGameRequest() { return this.lastRequest; }
    isRoundTerminalAction(action: string) { return action === 'SPIN'; }
    getExactFollowUpRequest(action: string) {
        if(action==='PICK_FREE_SPINS'&&this.game.sg.goldenChiefPaidContract==='golden-chief-own-totem-v6')return {event:'Logic',parameters:{__sgGoldenCollect:'1'}};
        if(action==='FEATURE'&&this.game.sg.goldenChiefPaidContract==='golden-chief-own-totem-v6')return {event:'EndGame',parameters:{}};
        if(action === 'PLAY') return {event:'EndGame',parameters:{}};
        if(action==='FREE_SPIN'&&this.game.sg.fudaFreeContract==='fuda-own-natural-free-v4')return {event:'Logic',parameters:{totalStake:'200'}};
        if(action === 'FREE_SPIN') { assert(this.game.sg.freeStake,'AG integrity: SG own free request not mapped');return {event:'Logic',parameters:{...this.game.sg.freeStake}}; }
        throw new Error('AG integrity: SG observed action not mapped');
    }
    private payload(event:string,parameters:Record<string,any>) {
        const h={...this.game.sg.header,sessionID:this.session};
        const header='<Header '+Object.entries(h).map(([k,v])=>`${k}="${escape(v)}"`).join(' ')+'/>';
        if(event==='Logic'&&this.game.sg.healthyComponentsContract){const kind=ownHealthyComponentsBinding(this.game);if(this.action==='FREE_SPIN'){assert(kind!=='jinji'&&Object.keys(parameters).length===0,'AG integrity: SG healthy free request');return `<GameRequest type="Logic">${header}</GameRequest>`;}assert(this.action==='SPIN'&&JSON.stringify(parameters)===JSON.stringify(this.game.sg.stake),'AG integrity: SG healthy paid request');const ownStake='<Stake '+Object.entries(parameters).map(([k,v])=>`${k}="${escape(v)}"`).join(' ')+'/>';if(kind==='megaways')return `<GameRequest type="Logic">${header}${ownStake}<PaylineCount count="1"/><AccountData><CurrencyMultiplier>1</CurrencyMultiplier></AccountData></GameRequest>`;return `<GameRequest type="Logic">${header}<AccountData><CurrencyMultiplier>1</CurrencyMultiplier></AccountData>${ownStake}</GameRequest>`;}
        if(event==='Logic'&&this.game.sg.eightyFortunesContract&&Object.keys(parameters).length){assert(this.action==='SPIN'&&this.game.gameId==='32750'&&JSON.stringify(parameters)===JSON.stringify({creditBet:'88',betMultiplier:'2'}),'AG integrity: SG 88 Fortunes own paid request');return `<GameRequest type="Logic">${header}<AccountData><CurrencyMultiplier>1</CurrencyMultiplier></AccountData><SpinInfo creditBet="88" betMultiplier="2"/></GameRequest>`;}
        if(event==='Logic'&&this.game.sg.logicRequestNode==='WagerInfo'){
            if(this.game.sg.fudaPaidContract){if(this.action==='FREE_SPIN'){assert(this.game.gameId==='32769'&&this.game.sg.fudaFreeContract==='fuda-own-natural-free-v4'&&JSON.stringify(parameters)===JSON.stringify({totalStake:'200'}),'AG integrity: SG Fu own free wager');return `<GameRequest type="Logic">${header}<WagerInfo totalStake="200"/><AccountData><CurrencyMultiplier>1</CurrencyMultiplier></AccountData></GameRequest>`;}assert(this.action==='SPIN'&&this.game.gameId==='32769'&&this.game.sg.fudaPaidContract==='fuda-own-natural-paid-display-v3'&&JSON.stringify(parameters)===JSON.stringify({totalStake:'200',featureBet:'0'}),'AG integrity: SG Fu Dao Le own request');return `<GameRequest type="Logic">${header}<WagerInfo totalStake="200" featureBet="0"/><AccountData><CurrencyMultiplier>1</CurrencyMultiplier></AccountData></GameRequest>`;}
            assert(this.game.gameId==='32767'&&this.game.sg.fireQueenPaidContract==='fire-queen-own-paid-v1'&&this.action==='SPIN'&&Object.keys(parameters).join('|')==='totalStake'&&parameters.totalStake==='50','AG integrity: SG Fire Queen own request');
            return `<GameRequest type="Logic">${header}<AccountData><CurrencyMultiplier>1</CurrencyMultiplier></AccountData><WagerInfo totalStake="50"/></GameRequest>`;
        }
        if(Object.prototype.hasOwnProperty.call(parameters,'__sgGoldenCollect')){assert(event==='Logic'&&this.action==='PICK_FREE_SPINS'&&this.game.sg.goldenChiefPaidContract==='golden-chief-own-totem-v6'&&Object.keys(parameters).length===1&&parameters.__sgGoldenCollect==='1','AG integrity: SG Golden Chief collect request');return `<GameRequest type="Logic">${header}<AccountData><CurrencyMultiplier>1</CurrencyMultiplier></AccountData><Gamble collect="1"/></GameRequest>`;}
        const stake=Object.keys(parameters).length?'<Stake '+Object.entries(parameters).map(([k,v])=>`${k}="${escape(v)}"`).join(' ')+'/>':'';
        if(event==='Logic'&&(this.game.sg.desertCatsContract||this.game.sg.jinjiEndlessContract)) {
            const kind=ownHealthyPaidBinding(this.game);
            assert(this.action==='SPIN'&&JSON.stringify(parameters)===JSON.stringify(kind==='desert'?{total:'200'}:{total:'16',gameMode:'0'}),'AG integrity: SG own healthy paid request');
            return `<GameRequest type="Logic"><AccountData><CurrencyMultiplier>1</CurrencyMultiplier></AccountData>${header}${stake}<PaylineCount count="${this.game.sg.logicPaylineCount}"/></GameRequest>`;
        }
        // Own Dragon client serializes AccountData for a stake-less free Logic too.
        // This is an explicit per-game wire binding, never a guessed feature stake.
        const freeAccount = event==='Logic' && !stake && this.game.sg.freeLogicCurrencyMultiplier !== undefined;
        if(freeAccount) assert(this.game.sg.freeLogicCurrencyMultiplier==='1','AG integrity: SG own free currency binding');
        return `<GameRequest type="${event}">${stake?'<AccountData><CurrencyMultiplier>1</CurrencyMultiplier></AccountData>':''}${header}${freeAccount?'<AccountData><CurrencyMultiplier>1</CurrencyMultiplier></AccountData>':''}${stake}</GameRequest>`;
    }
    private async exchange(event:string,parameters:Record<string,any>):Promise<WireStep> {
        assert(!this.closed,'AG integrity: SG session closed');const payload=this.payload(event,parameters);
        const ordinal=++this.ordinal;
        const requestKind = event==='Init' ? 'initialization' : this.action==='SPIN' ? 'round-start' : 'round-follow-up';
        if(event!=='Init')this.gameplayRequestHasBeenSent=true;
        const context: SGRequestEvidence = {event,ordinal,requestKind,gameplayRequestHasBeenSent:this.gameplayRequestHasBeenSent};
        if(this.transport) {
            const step=await this.transport(event,payload);
            if(step.httpStatus!==undefined && !(step.httpStatus>=200 && step.httpStatus<300)) {
                const fault=httpSourceFault({...context,httpStatus:step.httpStatus,responseSHA256:crypto.createHash('sha256').update(step.responsePayload).digest('hex')});
                this.close();throw this.closedFaultForFutureSession(fault);
            }
            return step;
        }
        this.evidence({phase:'intent',ordinal,event,payload});
        const start=Date.now(),deadline=sgRequestTimeoutMs(this.game);let response:Response | undefined,text:string;
        try {
            response=await fetch(this.game.sg.endpoint,{method:'POST',redirect:'error',signal:AbortSignal.timeout(deadline),
                headers:{'Content-Type':'text/xml; charset=utf-8',...(this.cookies.size?{Cookie:[...this.cookies].map(([k,v])=>k+'='+v).join('; ')}:{})},body:payload});
            text=await response.text();
        } catch(error) {
            const fault=transportSourceFault(context);
            this.evidence({phase:'unknown',ordinal,event,...sourceFaultMetadata(fault),transportDiagnostic:sgTransportDiagnostic(error,start,deadline,Date.now(),response?.status)});this.close();
            throw this.closedFaultForFutureSession(fault);
        }
        assert(response,'AG integrity: SG missing transport response');
        const fault=response.ok ? null : httpSourceFault({...context,httpStatus:response.status,responseSHA256:crypto.createHash('sha256').update(text).digest('hex')});
        this.evidence({phase:'response',ordinal,event,httpStatus:response.status,text,...(fault ? sourceFaultMetadata(fault) : {})});
        if(fault){this.close();throw this.closedFaultForFutureSession(fault);}
        for(const cookie of response.headers.getSetCookie?.() || []) {const pair=cookie.split(';')[0],at=pair.indexOf('=');if(at>0)this.cookies.set(pair.slice(0,at),pair.slice(at+1));}
        return {msgId:event,requestPayload:payload,responsePayload:text,elapsedMs:Date.now()-start};
    }
    private closedFaultForFutureSession(fault:SGSourceFault):Error {
        if(fault.category!=='execution-unknown' || !this.game.sg.unknownFreeSessionRecovery)return fault;
        assert(this.game.sg.unknownFreeSessionRecovery==='original-ag-discard-free-v1',
            'AG integrity: SG unknown Free session recovery contract');
        assert(this.game.sg.header.freePlay==='Y'&&this.closed&&this.cookies.size===0
            &&/^Free:[0-9a-f]{32}$/.test(this.freshFreeId),
            'AG integrity: SG old uncertain session not sealed');
        if(!['Logic','EndGame'].includes(fault.evidence.event))return fault;
        const status=fault.evidence.httpStatus;
        if(status!==undefined && ![408,425,429,500,502,503,504,520,521,522,523,524].includes(status))return fault;
        // The old outcome stays unknown and cannot be retried. Only a later,
        // independent Free session is eligible under original AG finite reset.
        this.evidence({phase:'sealed-session-recovery',ordinal:fault.evidence.ordinal,
            event:fault.evidence.event,oldOutcomeStillUnknown:true,oldRequestReplays:0,
            retryAction:'original-ag-discard-then-new-free-session'});
        return new SGClosedFreeSessionDiscard(fault);
    }
    private readEnvelope(step:WireStep,event:string) {
        const r=xml.parse(step.responsePayload)?.GameResponse;
        assert(r && r.type===event && r.Header && !r.Error && !r.Errors,'AG integrity: SG response envelope');
        assert(String(r.Header.gameID)===String(this.game.sg.header.gameID),'AG integrity: SG response game');
        assert(typeof r.Header.sessionID==='string'&&r.Header.sessionID.length>0,'AG integrity: SG response session');
        const balances=list(r.Balances?.Balance).filter(b=>b.name==='CASH_BALANCE');assert(balances.length===1,'AG integrity: SG cash balance');
        this.balance=integer(balances[0].value,'cash balance');this.session=r.Header.sessionID;
        return r;
    }
    async callGameData(event:string,parameters:Record<string,any>|null) {
        const first=this.action==='SPIN';
        if(first) {assert(event==='Logic','AG integrity: SG round start');this.startBalance=this.balance;this.totalWin=0;this.free=undefined;this.steps=[];this.lastBase=undefined;this.eightyBase=undefined;this.fudaBase=undefined;this.coolJewelsBase=undefined;this.goldenPending=undefined;}
        else assert(event===this.getExactFollowUpRequest(this.action).event,'AG integrity: SG request order');
        assert(Number.isSafeInteger(this.startBalance),'AG integrity: SG missing initial balance');
        const step=await this.exchange(event,parameters || {}),r=this.readEnvelope(step,event);
        if(this.game.sg.healthyComponentsContract){assert(Object.keys(r).every(k=>['type','Header','AccountData','Balances','GameResult',...(this.game.gameId==='32777'?['SymbolGrids']:[])].includes(k)),'AG integrity: SG healthy response schema');if(r.SymbolGrids!==undefined)assert(this.game.gameId==='32777'&&r.SymbolGrids==='','AG integrity: SG healthy symbols envelope changed');}
        this.steps.push({...step,responseBalance:this.balance});this.lastRequest={event,parameters:structuredClone(parameters)};
        if(event==='EndGame') {
            assert(!r.GameResult,'AG integrity: SG unexpected EndGame result');
            assert(this.balance===this.startBalance-this.game.sg.betRaw+this.totalWin,'AG integrity: SG final balance mismatch');
            this.action='SPIN';
        } else {
            const g=r.GameResult;
            if(this.game.sg.healthyComponentsContract){if(first)this.healthyComponentsBase=undefined;const mapped=validateOwnHealthyComponents(this.game,g,first,this.free,this.healthyComponentsBase,this.totalWin);this.totalWin=mapped.win;this.free=mapped.free;this.healthyComponentsBase=mapped.base;this.action=this.free?.freeSpinsRemaining>0?'FREE_SPIN':'PLAY';}
            else if(this.game.sg.eightyFortunesContract){const mapped=validateEightyFortunesData(this.game,g,first,this.free,this.eightyBase,this.totalWin);if(first)this.eightyBase=structuredClone(g);this.totalWin=mapped.win;this.free=mapped.free;this.action=this.free?.freeSpinsRemaining>0?'FREE_SPIN':'PLAY';}
            else if(this.game.sg.coolJewelsFreeContract){const mapped=validateCoolJewelsFreeData(this.game,g,first,this.free,this.coolJewelsBase,this.totalWin);this.totalWin=mapped.win;this.free=mapped.free;this.coolJewelsBase=mapped.base;this.action=this.free?.freeSpinsRemaining>0?'FREE_SPIN':'PLAY';}
            else if(first&&this.game.sg.coolJewelsPaidContract){this.totalWin=validateCoolJewelsPaidData(this.game,g);this.action='PLAY';}
            else if(first&&this.game.sg.fireQueenPaidContract){this.totalWin=validateFireQueenPaidData(this.game,g);this.action='PLAY';}
            else if(first&&(this.game.sg.desertCatsContract||this.game.sg.jinjiEndlessContract)){this.totalWin=validateHealthyPaidData(this.game,g);this.action='PLAY';}
            else if(this.game.sg.fudaFreeContract){const mapped=validateFudaOwnFreeData(this.game,g,first,this.free,this.fudaBase,this.totalWin);this.totalWin=mapped.win;this.free=mapped.free;this.fudaBase=mapped.base;this.action=this.free?.freeSpinsRemaining>0?'FREE_SPIN':'PLAY';}
            else if(first&&(this.game.sg.fudaPaidContract||this.game.sg.heidiPaidContract)){this.totalWin=validateOwnRequestVariantData(this.game,g);this.action='PLAY';}
            else {
            assert(g&&(g.BGInfo||g.FSInfo||(this.action==='PICK_FREE_SPINS'&&this.game.sg.goldenChiefPaidContract==='golden-chief-own-totem-v6')),'AG integrity: SG game result');
            const known=new Set(['stake','stakePerLine','paylineCount','totalWin','betID','ReelResults','BGInfo','FSInfo','BaseGameRecoveryInfo',...(this.game.sg.goldenChiefPaidContract?['PaylineCountInfo','SymbolUpgrade','WildExpansion',...(this.game.sg.goldenChiefPaidContract==='golden-chief-own-totem-v6'?['BonusWheel','GambleInfo','CanyonBonus','TotemBonus']:[])]:[]),...(this.game.sg.passiveResultFields || []),...(this.game.sg.wildPositionContract ? ['WildInfo'] : []),...(this.game.sg.compassContract ? ['Compass'] : [])]);
            assert(Object.keys(g).every(k=>known.has(k)),'AG integrity: SG observed feature needs mapping');
            const ownGoldenFree=!first&&this.action==='FREE_SPIN'&&this.game.sg.goldenChiefPaidContract==='golden-chief-own-totem-v6'&&g.FSInfo!==undefined;
            const goldenWin=ownGoldenFree?validateGoldenChiefFree(this.game,g,this.free,this.goldenPending,this.lastBase,this.totalWin):undefined;
            const passiveTotem=first&&this.game.sg.goldenChiefPaidContract==='golden-chief-own-totem-v6'&&g.TotemBonus!==undefined;
            if(passiveTotem)validateGoldenChiefTotem(this.game,g);
            const passiveCanyon=first&&this.game.sg.goldenChiefPaidContract==='golden-chief-own-totem-v6'&&g.CanyonBonus!==undefined;
            if(passiveCanyon)validateGoldenChiefCanyon(this.game,g);
            const pendingGolden=!passiveTotem&&!passiveCanyon&&first&&this.game.sg.goldenChiefPaidContract==='golden-chief-own-totem-v6'&&g.BonusWheel!==undefined?validateGoldenChiefGambleIntro(this.game,g):undefined;
            const confirmedGolden=!first&&this.action==='PICK_FREE_SPINS'&&this.game.sg.goldenChiefPaidContract==='golden-chief-own-totem-v6';
            if(confirmedGolden){assert(this.goldenPending,'AG integrity: SG Golden Chief pending collect missing');validateGoldenChiefCollectConfirmation(this.game,g,this.goldenPending,this.lastBase);}
            if(this.game.sg.goldenChiefPaidContract&&pendingGolden===undefined&&!confirmedGolden&&!passiveTotem&&!passiveCanyon&&!ownGoldenFree)validateGoldenChiefPaidData(this.game,g);
            if(g.WildInfo !== undefined)validateDragonWildInfo(this.game,g);
            if(g.Compass !== undefined)validateHimalayaCompass(this.game,g,this.free);
            assert(integer(g.stake,'stake')===this.game.sg.betRaw,'AG integrity: SG changed stake');
            const bg=(confirmedGolden||ownGoldenFree)?g.BaseGameRecoveryInfo.BGInfo:g.BGInfo;
            if(this.game.sg.omitsBaseRemaining)assert(bg.baseGameSpinsRemaining===undefined,'AG integrity: SG changed base schema');
            else assert(integer(bg.baseGameSpinsRemaining,'remaining base spins')===0,'AG integrity: SG remaining base action not mapped');
            if(g.BonusData)assert(g.BonusData.BonusBet==='0'&&Object.keys(g.BonusData).length===1,'AG integrity: SG purchased bonus not mapped');
            this.totalWin=goldenWin??integer(bg.totalWagerWin,'cumulative wager win');
            if(!confirmedGolden)assert(g.ReelResults && list(g.ReelResults.ReelSpin).length>0,'AG integrity: SG reel result');
            if(first)this.lastBase=structuredClone(g.ReelResults);
            if(g.BaseGameRecoveryInfo) {
                assert(this.lastBase && JSON.stringify(g.BaseGameRecoveryInfo.ReelResults)===JSON.stringify(this.lastBase),'AG integrity: SG base recovery changed');
            }
            if(passiveTotem||passiveCanyon){this.action='FEATURE';}
            else if(pendingGolden!==undefined){this.goldenPending={count:pendingGolden,stop:g.BonusWheel.stopPosition,baseWin:integer(bg.bgWinnings,'Golden Chief pending base')};this.free={freeSpinsTotal:pendingGolden,freeSpinsPlayed:0,freeSpinsRemaining:pendingGolden,accumulativeWin:this.totalWin/100};this.action='PICK_FREE_SPINS';}
            else if(confirmedGolden){assert(this.free?.freeSpinsTotal===this.goldenPending!.count&&this.free.freeSpinsPlayed===0,'AG integrity: SG Golden Chief confirmed free budget');this.action='FREE_SPIN';}
            else if(g.FSInfo) {
                const f=g.FSInfo,total=integer(f.freeSpinsTotal,'free total'),played=integer(f.freeSpinNumber,'free played');
                assert(played<=total,'AG integrity: SG free counter');
                const freeWin=integer(f.fsWinnings,'free winnings'),baseWin=integer(bg.bgWinnings,'base winnings');
                assert(baseWin+freeWin===this.totalWin,'AG integrity: SG component winnings');
                if(this.free)assert(played>this.free.freeSpinsPlayed && total>=this.free.freeSpinsTotal,'AG integrity: SG nonadvancing free state');
                this.free={freeSpinsTotal:total,freeSpinsPlayed:played,freeSpinsRemaining:total-played,accumulativeWin:this.totalWin/100};
                this.action=played<total?'FREE_SPIN':'PLAY';
            } else {
                assert(!this.free,'AG integrity: SG free state disappeared');
                assert(list(g.ReelResults.ReelSpin).every(s=>s.freeSpin==='N'&&s.bonusAwarded==='N'),'AG integrity: SG unclassified feature');
                this.action='PLAY';
            }
            }
        }
        // AG retains every response in its own action sequence. Do not embed the
        // entire growing SG prefix in each intermediate response (quadratic BSON).
        // The terminal response still provides every exact SG request/response for playback.
        const playbackSteps = this.action==='SPIN' ? this.steps : this.steps.slice(-1);
        return {NextActionInfo:{nextAction:this.action},PlayerBalanceInfo:{preWagerBalance:this.startBalance/100,balance:this.balance/100,wager:this.game.sg.betRaw/100,resultAmount:this.totalWin/100},
            ...(this.free?{FreeSpinsInfo:structuredClone(this.free)}:{}),SGWireResponse:step.responsePayload,
            // Data-only SG playback mapping. AG keeps all of its round/validation/storage fields.
            capturePlatform:'sg',gameId:this.game.sg.runtimeGameId,runtimeSlug:this.game.sg.runtimeSlug,
            startBalance:this.startBalance/100,endBalance:this.balance/100,totalWin:this.totalWin/100,
            stepCount:playbackSteps.length,msgIds:playbackSteps.map(step=>step.msgId),steps:structuredClone(playbackSteps),
            money:{startBalanceRaw:this.startBalance,endBalanceRaw:this.balance,betRaw:this.game.sg.betRaw,totalWinRaw:this.totalWin}};
    }
    close() { if(this.closed)return;this.closed=true;this.cookies.clear();if(this.journal!==null){fs.fsyncSync(this.journal);fs.closeSync(this.journal);this.journal=null;} }
}
