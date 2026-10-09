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
 assert(game.gameId==='32771'&&game.dbName==='sg_golden_chief'&&game.sg?.runtimeGameId===32993&&game.sg?.header?.gameID==='20125'&&game.sg?.header?.gameCodeRGI==='goldenchief'&&game.sg?.betRaw===100&&game.sg?.goldenChiefPaidContract==='golden-chief-own-paid-v1','AG integrity: SG Golden Chief binding');
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
 if(g.SymbolUpgrade){keys(g.SymbolUpgrade,'replacementSymbol|positions');assert(active===100&&g.SymbolUpgrade.replacementSymbol==='3','AG integrity: SG Golden Chief upgrade');positions(g.SymbolUpgrade.positions,20);}
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
    getPickParams(_index: number|string): never { throw new Error('AG integrity: SG pick protocol not mapped'); }
    getInitialRoundRequest() { return {event:'Logic',parameters:this.getSpinParams()}; }
    getLastGameRequest() { return this.lastRequest; }
    isRoundTerminalAction(action: string) { return action === 'SPIN'; }
    getExactFollowUpRequest(action: string) {
        if(action === 'PLAY') return {event:'EndGame',parameters:{}};
        if(action === 'FREE_SPIN') { assert(this.game.sg.freeStake,'AG integrity: SG own free request not mapped');return {event:'Logic',parameters:{...this.game.sg.freeStake}}; }
        throw new Error('AG integrity: SG observed action not mapped');
    }
    private payload(event:string,parameters:Record<string,any>) {
        const h={...this.game.sg.header,sessionID:this.session};
        const header='<Header '+Object.entries(h).map(([k,v])=>`${k}="${escape(v)}"`).join(' ')+'/>';
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
        if(first) {assert(event==='Logic','AG integrity: SG round start');this.startBalance=this.balance;this.totalWin=0;this.free=undefined;this.steps=[];this.lastBase=undefined;}
        else assert(event===this.getExactFollowUpRequest(this.action).event,'AG integrity: SG request order');
        assert(Number.isSafeInteger(this.startBalance),'AG integrity: SG missing initial balance');
        const step=await this.exchange(event,parameters || {}),r=this.readEnvelope(step,event);
        this.steps.push({...step,responseBalance:this.balance});this.lastRequest={event,parameters:structuredClone(parameters)};
        if(event==='EndGame') {
            assert(!r.GameResult,'AG integrity: SG unexpected EndGame result');
            assert(this.balance===this.startBalance-this.game.sg.betRaw+this.totalWin,'AG integrity: SG final balance mismatch');
            this.action='SPIN';
        } else {
            const g=r.GameResult;assert(g&&g.BGInfo,'AG integrity: SG game result');
            const known=new Set(['stake','stakePerLine','paylineCount','totalWin','betID','ReelResults','BGInfo','FSInfo','BaseGameRecoveryInfo',...(this.game.sg.goldenChiefPaidContract?['PaylineCountInfo','SymbolUpgrade','WildExpansion']:[]),...(this.game.sg.passiveResultFields || []),...(this.game.sg.wildPositionContract ? ['WildInfo'] : []),...(this.game.sg.compassContract ? ['Compass'] : [])]);
            assert(Object.keys(g).every(k=>known.has(k)),'AG integrity: SG observed feature needs mapping');
            if(this.game.sg.goldenChiefPaidContract)validateGoldenChiefPaidData(this.game,g);
            if(g.WildInfo !== undefined)validateDragonWildInfo(this.game,g);
            if(g.Compass !== undefined)validateHimalayaCompass(this.game,g,this.free);
            assert(integer(g.stake,'stake')===this.game.sg.betRaw,'AG integrity: SG changed stake');
            const bg=g.BGInfo;
            if(this.game.sg.omitsBaseRemaining)assert(bg.baseGameSpinsRemaining===undefined,'AG integrity: SG changed base schema');
            else assert(integer(bg.baseGameSpinsRemaining,'remaining base spins')===0,'AG integrity: SG remaining base action not mapped');
            if(g.BonusData)assert(g.BonusData.BonusBet==='0'&&Object.keys(g.BonusData).length===1,'AG integrity: SG purchased bonus not mapped');
            this.totalWin=integer(bg.totalWagerWin,'cumulative wager win');
            assert(g.ReelResults && list(g.ReelResults.ReelSpin).length>0,'AG integrity: SG reel result');
            if(first)this.lastBase=structuredClone(g.ReelResults);
            if(g.BaseGameRecoveryInfo) {
                assert(this.lastBase && JSON.stringify(g.BaseGameRecoveryInfo.ReelResults)===JSON.stringify(this.lastBase),'AG integrity: SG base recovery changed');
            }
            if(g.FSInfo) {
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
