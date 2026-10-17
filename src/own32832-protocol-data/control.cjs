'use strict';
// SG protocol DATA projection. No native entry, DOM, graphics, audio or fabricated callbacks.
const assert=require('node:assert/strict');
exports.createOwn32832ProtocolControl=function({native}){
 assert(native&&typeof native.decode==='function'&&typeof native.gsd==='function'&&typeof native.currentWin==='function');
 let initialized=false,inFree=false,pending=null,cap,requestOrdinal=0,sealed=false;
 const integer=(v,label)=>{assert(typeof v==='string'&&/^-?\d+$/.test(v)&&Number.isSafeInteger(Number(v)),label);return Number(v)};
 const fresh=()=>{assert(initialized&&!sealed,'own32832 current initialized protocol scope');};
 const paid=()=>({event:'BET',parameters:{GN:'keytosuccess96',BPR:'1',AP:'false',buyin:'false'}});
 const free=()=>({event:'FREE_GAME',parameters:{GN:'keytosuccess96',BPR:'1',AP:'false'}});
 return Object.freeze({
  initialize(raw){
   assert(!initialized&&!sealed,'own32832 Init once');const p=native.decode(raw);
   assert(p.MSGID==='INIT','own32832 actual Init event');
   assert(p.R===undefined||p.R==='0','own32832 recovery not authorized');
   assert(p.REC===undefined&&p.FID===undefined&&p.IFG!=='1','own32832 existing round at fresh Init');
   assert(p.IFR===undefined||p.IFR==='0','own32832 promotional Init unmapped');
   assert(p.FRR===undefined||Number(p.FRR)===0,'own32832 promotional rounds unmapped');
   const start=integer(p.AB,'own32832 actual Init AB');assert(integer(p.B,'own32832 actual Init B')===start);
   // Own formatInitResponse derives the menu from BD; capture explicitly selects source BPR1.
   assert(Array.isArray(p.BD)&&p.BD.slice(0,-1).map(Number).includes(1),'own32832 actual Init BPR1 unavailable');
   // Own configure has empty jurisdiction/operator override maps. CAP absence is the source
   // nonfinancial disabled-cap convention, never a replacement for B, AB, TW or bonus money.
   cap=p.CAP?Number(p.CAP):0;assert(Number.isFinite(cap)&&cap>=0,'own32832 actual Init CAP');
   initialized=true;return Object.freeze({balanceRaw:start,selectedBPR:1,betRaw:20});
  },
  initial(){fresh();assert(!pending&&!inFree,'own32832 previous round pending');pending=paid();return structuredClone(pending)},
  exact(){fresh();assert(pending,'own32832 no current mapped request');return structuredClone(pending)},
  accept(event,parameters,raw){
   try{
   fresh();assert(pending&&event===pending.event,'own32832 actual request order');assert.deepEqual(parameters,pending.parameters,'own32832 actual request DATA');
   const p=native.decode(raw);assert(p.MSGID===event,'own32832 accepted event mismatch');
   const balance=integer(p.B,'own32832 actual B'),available=integer(p.AB,'own32832 actual AB'),win=integer(p.TW,'own32832 actual TW');assert(balance>=0&&available>=0&&win>=0);
   assert(p.IFR===undefined||p.IFR==='0','own32832 promotional response unmapped');
   const gsd=p.GSD===undefined?{}:native.gsd(p.GSD),triggers=p.WC?.[2]===undefined?0:Number(p.WC[2]);assert(Number.isFinite(triggers),'own32832 source trigger field');
   // Source max-cap lifecycle is pinned, but its local acknowledgement is not wired here.
   // Hold the accepted raw frame instead of manufacturing End or changing NFG.
   assert(!native.maxCap(win,cap),'own32832 max-cap acknowledgement connection unmapped');
   let reason='ordinary-end';
   if(gsd.TGB&&gsd.TGB[0]>='3'&&triggers===1){
    assert(!inFree&&p.CFGG!==undefined&&Number(p.CFGG)===0,'own32832 free intro request provenance unmapped');
    inFree=true;reason='source-free-intro';
   }else if(inFree){
    assert(typeof gsd.FSL==='string'&&Number.isFinite(parseInt(gsd.FSL)),'own32832 source free limit absent');
    const current=native.currentWin(p);assert(Number.isFinite(current)&&current>=0,'own32832 source decoded win total');
    if(current>=parseInt(gsd.FSL)){inFree=false;reason='source-free-win-limit-end'}else reason='source-free-continue';
   }
   pending=inFree?free():null;requestOrdinal++;
   return Object.freeze({next:pending?structuredClone(pending):null,balanceRaw:balance,availableRaw:available,totalWinRaw:win,inFree,reason,requestOrdinal,rawMoneyRequired:true,noSyntheticTerminal:true});
   }catch(error){sealed=true;throw error;}
  },
  seal(){sealed=true;},
  status(){return Object.freeze({initialized,inFree,requestOrdinal,pendingRetained:!!pending,sealed,retryAllowed:false})}
 });
};
