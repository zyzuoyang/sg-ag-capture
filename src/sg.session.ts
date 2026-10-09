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

export function validateGoldenChiefBoardExtras(game:AGGameConfig,g:any):number {
 assert(game.gameId==='32771'&&game.dbName==='sg_golden_chief'&&game.sg?.runtimeGameId===32993&&game.sg?.header?.gameID==='20125'&&game.sg?.header?.gameCodeRGI==='goldenchief','AG integrity: SG Golden board binding');
 const keys=(v:any,n:string)=>assert(v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join('|')===n.split('|').sort().join('|'),'AG integrity: SG Golden board schema');
 const pos=(v:any,max:number)=>{assert(typeof v==='string'&&/^\d+(?:\|\d+)*$/.test(v),'AG integrity: SG Golden board positions');const a=v.split('|').map((n:string)=>integer(n,'Golden board position'));assert(new Set(a).size===a.length&&a.every((n:number)=>n<max),'AG integrity: SG Golden board positions');return a;};
 keys(g.PaylineCountInfo,'normalPaylineCount|bonusPaylineCount|activePaylineCount');assert(g.PaylineCountInfo.normalPaylineCount==='20'&&g.PaylineCountInfo.bonusPaylineCount==='100','AG integrity: SG Golden Init board lines');const active=integer(g.PaylineCountInfo.activePaylineCount,'Golden board active');assert([20,100].includes(active),'AG integrity: SG Golden active lines');
 if(g.WildExpansion){keys(g.WildExpansion,'originalWildPositions|wildReels');const a=pos(g.WildExpansion.originalWildPositions,20),b=pos(g.WildExpansion.wildReels,5);assert(active===100&&a.every((n:number)=>b.includes(n%5))&&b.every((n:number)=>a.some((p:number)=>p%5===n)),'AG integrity: SG Golden board wild columns');}else assert(active===20,'AG integrity: SG Golden missing expanded wild');
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
 assert(integer(g.CanyonBonus.canyonID,'Canyon ID')<10,'AG integrity: SG Golden Chief Canyon Init path');const text=g.CanyonBonus.steps;assert(typeof text==='string'&&/^(?:[1-9]\d*\|)*-1$/.test(text),'AG integrity: SG Golden Chief completed Canyon display steps');const moves=text.split('|').slice(0,-1).map((v:string)=>integer(v,'Canyon move'));assert(moves.every(Number.isSafeInteger),'AG integrity: SG Golden Chief Canyon moves');
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
 assert(integer(b.BGInfo.bgWinnings,'Golden recovered base')===pending.baseWin&&integer(b.BGInfo.totalWagerWin,'Golden recovered wager')===pending.baseWin&&b.BonusWheel.stopPosition===pending.stop&&b.BGInfo.baseGameSpinsRemaining==='0'&&b.BGInfo.isBigBet==='0'&&b.BGInfo.isMaxWin==='0'&&b.BGInfo.chiefWin==='0','AG integrity: SG Golden free base state');
 const active=validateGoldenChiefBoardExtras(game,g);validateGoldenChiefBoardExtras(game,b);
 assert(g.stake==='100'&&g.stakePerLine==='5'&&integer(g.paylineCount,'Golden current paylines')===active&&g.FSInfo.isMaxWin==='0','AG integrity: SG Golden free wager');
 const played=integer(g.FSInfo.freeSpinNumber,'Golden played'),total=integer(g.FSInfo.freeSpinsTotal,'Golden total'),awarded=integer(g.FSInfo.freespinsAwarded,'Golden awarded');
 assert(played===prior.freeSpinsPlayed+1&&total===prior.freeSpinsTotal+awarded&&played<=total,'AG integrity: SG Golden free transition');
 keys(g.ReelResults,'numSpins|ReelSpin');const spins=list(g.ReelResults.ReelSpin);assert(g.ReelResults.numSpins==='1'&&spins.length===1,'AG integrity: SG Golden free reel');const r=spins[0];
 assert(r.spinIndex==='0'&&integer(r.reelsetIndex,'Golden free Init set')>=5&&integer(r.reelsetIndex,'Golden free Init set')<=14&&r.freeSpin==='Y'&&r.bonusAwarded==='Y'&&r.winCountSC==='1','AG integrity: SG Golden free flags');
 keys(r.ScatterWin,'#text|winVal|awardIndex');assert(r.ScatterWin.winVal==='0'&&r.ScatterWin.awardIndex==='0','AG integrity: SG Golden free scatter');
 const wins=list(r.PaylineWin);assert(wins.length===integer(r.winCountPL,'Golden free line count'),'AG integrity: SG Golden free lines');let win=0;const seen=new Set<number>();
 for(const w of wins){const index=integer(w.index,'Golden line');assert(index<active&&!seen.has(index),'AG integrity: SG Golden duplicate line');seen.add(index);integer(w.awardIndex,'Golden award');integer(w.awardTableIndex,'Golden table');assert(typeof w['#text']==='string'&&/^\d+(?:\|\d+)*$/.test(w['#text'])&&w['#text'].split('|').every((v:string)=>integer(v,'Golden symbol position')<20),'AG integrity: SG Golden positions');win+=integer(w.winVal,'Golden line amount');}
 const freeWin=integer(g.FSInfo.fsWinnings,'Golden free winnings');assert(Number.isSafeInteger(win)&&win===integer(r.spinWins,'Golden spin amount')&&win===integer(g.totalWin,'Golden current total')&&pending.baseWin+freeWin===priorWin+win,'AG integrity: SG Golden free monetary components');
 assert(Number.isSafeInteger(pending.baseWin+freeWin),'AG integrity: SG Golden money overflow');return pending.baseWin+freeWin;
}


export function validateGoldenChiefTotem(game:AGGameConfig,g:any):void {
 assert(game.gameId==='32771'&&game.dbName==='sg_golden_chief'&&game.sg?.runtimeGameId===32993&&game.sg?.header?.gameID==='20125'&&game.sg?.header?.gameCodeRGI==='goldenchief'&&game.sg?.goldenChiefPaidContract==='golden-chief-own-totem-v6','AG integrity: SG Golden Totem binding');
 const keys=(v:any,names:string)=>assert(v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join('|')===names.split('|').sort().join('|'),'AG integrity: SG Golden Totem schema');
 keys(g,'stake|stakePerLine|paylineCount|totalWin|betID|ReelResults|BGInfo|PaylineCountInfo|BonusWheel|TotemBonus'+(g.WildExpansion?'|WildExpansion':'')+(g.SymbolUpgrade?'|SymbolUpgrade':''));keys(g.TotemBonus,'gameMode|totemType|numLives|winAmount|steps');keys(g.BonusWheel,'stopPosition');keys(g.BGInfo,'totalWagerWin|bgWinnings|baseGameSpinsRemaining|isBigBet|isMaxWin|chiefWin');keys(g.PaylineCountInfo,'normalPaylineCount|bonusPaylineCount|activePaylineCount');
 const active=validateGoldenChiefBoardExtras(game,g);const stop=integer(g.BonusWheel.stopPosition,'Totem wheel stop');assert(stop<12&&game.sg.goldenChiefWheelStrip[stop]===1&&JSON.stringify(game.sg.goldenChiefWheelStrip)===JSON.stringify([1,0,1,2,1,0,1,0,1,2,1,0]),'AG integrity: SG Golden Totem wheel');
 assert(g.stake==='100'&&g.stakePerLine==='5'&&integer(g.paylineCount,'Golden current paylines')===active&&g.PaylineCountInfo.normalPaylineCount==='20'&&g.PaylineCountInfo.bonusPaylineCount==='100'&&integer(g.PaylineCountInfo.activePaylineCount,'Golden active')===active&&g.BGInfo.baseGameSpinsRemaining==='0'&&g.BGInfo.isBigBet==='0'&&g.BGInfo.isMaxWin==='0'&&g.BGInfo.chiefWin==='0','AG integrity: SG Golden Totem wager');
 assert(g.TotemBonus.gameMode==='1'&&g.TotemBonus.totemType==='0'&&g.TotemBonus.numLives==='0'&&typeof g.TotemBonus.steps==='string'&&/^[012](?:\|[012])*$/.test(g.TotemBonus.steps),'AG integrity: SG Golden completed Totem display scope');
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
        try {const response=await this.exchange('Init',{});this.readEnvelope(response,'Init');}
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
        if(action === 'FREE_SPIN') { assert(this.game.sg.freeStake,'AG integrity: SG own free request not mapped');return {event:'Logic',parameters:{...this.game.sg.freeStake}}; }
        throw new Error('AG integrity: SG observed action not mapped');
    }
    private payload(event:string,parameters:Record<string,any>) {
        const h={...this.game.sg.header,sessionID:this.session};
        const header='<Header '+Object.entries(h).map(([k,v])=>`${k}="${escape(v)}"`).join(' ')+'/>';
        if(Object.prototype.hasOwnProperty.call(parameters,'__sgGoldenCollect')){assert(event==='Logic'&&this.action==='PICK_FREE_SPINS'&&this.game.sg.goldenChiefPaidContract==='golden-chief-own-totem-v6'&&Object.keys(parameters).length===1&&parameters.__sgGoldenCollect==='1','AG integrity: SG Golden Chief collect request');return `<GameRequest type="Logic">${header}<AccountData><CurrencyMultiplier>1</CurrencyMultiplier></AccountData><Gamble collect="1"/></GameRequest>`;}
        const stake=Object.keys(parameters).length?'<Stake '+Object.entries(parameters).map(([k,v])=>`${k}="${escape(v)}"`).join(' ')+'/>':'';
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
        if(first) {assert(event==='Logic','AG integrity: SG round start');this.startBalance=this.balance;this.totalWin=0;this.free=undefined;this.steps=[];this.lastBase=undefined;this.goldenPending=undefined;}
        else assert(event===this.getExactFollowUpRequest(this.action).event,'AG integrity: SG request order');
        assert(Number.isSafeInteger(this.startBalance),'AG integrity: SG missing initial balance');
        const step=await this.exchange(event,parameters || {}),r=this.readEnvelope(step,event);
        this.steps.push({...step,responseBalance:this.balance});this.lastRequest={event,parameters:structuredClone(parameters)};
        if(event==='EndGame') {
            assert(!r.GameResult,'AG integrity: SG unexpected EndGame result');
            assert(this.balance===this.startBalance-this.game.sg.betRaw+this.totalWin,'AG integrity: SG final balance mismatch');
            this.action='SPIN';
        } else {
            const g=r.GameResult;assert(g&&(g.BGInfo||g.FSInfo||(this.action==='PICK_FREE_SPINS'&&this.game.sg.goldenChiefPaidContract==='golden-chief-own-totem-v6')),'AG integrity: SG game result');
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
