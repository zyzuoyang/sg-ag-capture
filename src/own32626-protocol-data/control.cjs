'use strict';
// Own wire DATA only. Financial values and terminal counters must be present in raw responses.
const assert=require('node:assert/strict');
exports.createOwn32626ProtocolControl=function({native}){
 assert(native&&typeof native.decode==='function'&&typeof native.maxCap==='function');
 let initialized=false,sealed=false,pending=null,cap,ordinal=0;
 const integer=(v,label)=>{assert(typeof v==='string'&&/^-?\d+$/.test(v)&&Number.isSafeInteger(Number(v)),label);return Number(v)};
 const fields=()=>({GN:'reignofthemountainking',BPL:'5',AP:'false',LB:'10'});
 const request=event=>({event,parameters:fields()});
 const fresh=()=>assert(initialized&&!sealed,'own32626 current initialized protocol scope');
 return Object.freeze({
  initialize(raw){
   assert(!initialized&&!sealed,'own32626 Init once');const p=native.decode(raw);
   assert(p.MSGID==='INIT','own32626 actual Init event');
   assert(p.R===undefined||p.R==='0','own32626 recovery not mapped');
   assert(p.IFR===undefined||p.IFR==='0','own32626 promotional round not mapped');
   assert(p.IFG===undefined||p.IFG==='0','own32626 existing feature at fresh Init');
   const balance=integer(p.AB,'own32626 actual Init AB');assert(balance>=0);
   assert(Array.isArray(p.BD)&&p.BD.slice(0,-1).map(Number).includes(5),'own32626 actual Init BPL5 unavailable');
   // Own initGame uses Number(e.rawData.CAP); an absent nonfinancial cap is NaN in source.
   cap=Number(p.CAP);if(p.CAP!==undefined)assert(Number.isFinite(cap)&&cap>=0,'own32626 actual Init CAP');
   initialized=true;return Object.freeze({balanceRaw:balance,selectedBPL:5,selectedLB:10,betRaw:50});
  },
  initial(){fresh();assert(!pending,'own32626 previous request pending');pending=request('BET');return structuredClone(pending)},
  exact(){fresh();assert(pending,'own32626 no current mapped request');return structuredClone(pending)},
  accept(event,parameters,raw){
   fresh();assert(pending&&pending.event===event,'own32626 actual request order');assert.deepEqual(parameters,pending.parameters,'own32626 source request fields');
   const p=native.decode(raw);assert(p.MSGID===event,'own32626 accepted event mismatch');
   const balance=integer(p.B,'own32626 actual B'),available=integer(p.AB,'own32626 actual AB'),win=integer(p.TW,'own32626 actual TW');assert(balance>=0&&available>=0&&win>=0);
   assert(p.IFR===undefined||p.IFR==='0','own32626 promotional result not mapped');
   // Native max-cap acknowledgement alters a local counter. Its connection is not mapped;
   // preserve the accepted frame rather than implementing that alteration or inventing End.
   assert(!native.maxCap(win,cap),'own32626 max-cap acknowledgement connection unmapped');
   let remaining;
   if(p.NFG===undefined){
    // Own getGameContents has features=null when FID is absent and isFreeSpins is false.
    // This explicit inactive ordinary result has no bonus counter; do not create one.
    assert(p.IFG==='0'&&p.FID===undefined,'own32626 free/unknown result requires actual NFG');
   }else{remaining=integer(p.NFG,'own32626 actual next/end NFG');assert(remaining>=0,'own32626 negative next sentinel unmapped');}
   // Native readyForNextSpin and spin branch both select FREE_GAME on remaining > 0.
   // Native freeSpinsEnded selects IDLE only when total and current are equal.
   if(remaining===0&&p.IFG==='1'){
    const total=integer(p.TFG,'own32626 actual terminal TFG'),current=integer(p.CFGG,'own32626 actual terminal CFGG');
    assert(total===current,'own32626 native freeSpinsEnded selector not reached');
   }
   pending=remaining>0?request('FREE_GAME'):null;ordinal++;
   return Object.freeze({next:pending?structuredClone(pending):null,balanceRaw:balance,availableRaw:available,totalWinRaw:win,remaining,reason:pending?'source-positive-remaining-free-next':remaining===undefined?'source-explicit-inactive-ordinary-end':'source-zero-remaining-end',requestOrdinal:ordinal,noSyntheticTerminal:true});
  },
  seal(){sealed=true;},
  status(){return Object.freeze({initialized,sealed,requestOrdinal:ordinal,pendingRetained:!!pending,retryAllowed:false})}
 });
};
