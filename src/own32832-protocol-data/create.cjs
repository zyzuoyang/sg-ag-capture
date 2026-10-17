'use strict';
const vm=require('node:vm'),data=require('./source-DATA.json');
exports.create=function(){
 const context=vm.createContext({console:{error:()=>{throw Error('own32832 malformed protocol GSD')}},debug:()=>{}}),fn=n=>vm.runInContext('('+data.leaves.find(x=>x.name===n).source+')',context),api={};
 api.formatReelset=fn('formatReelset');api.returnArrayOfNumbers=fn('numbers');api.buildWinObject=fn('win');const decode=fn('decode'),sum=fn('sum'),gsd=fn('nativeGSDDecoder'),max=fn('ownMaxCapPredicate');
 const native={decode:s=>decode.call(api,s),gsd:s=>gsd.call(api,s),currentWin:p=>{const wins=[];if(p.WS!==undefined)for(const s of p.WS)if(s!=='')wins.push(api.buildWinObject(api.returnArrayOfNumbers(s.split(';'))));return sum(wins)},maxCap:(win,cap)=>max.call({maxCap:cap},win)};
 return require('./control.cjs').createOwn32832ProtocolControl({native});
};
