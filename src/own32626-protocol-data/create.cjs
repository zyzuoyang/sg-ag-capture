'use strict';
const vm=require('node:vm'),data=require('./source-DATA.json');
exports.create=function(){
 const context=vm.createContext({}),fn=n=>vm.runInContext('('+data.leaves.find(x=>x.name===n).source+')',context),api={};api.formatReelset=fn('formatReelset');const decode=fn('decode'),max=fn('isMaxCap');
 return require('./control.cjs').createOwn32626ProtocolControl({native:{decode:s=>decode.call(api,s),maxCap:(win,cap)=>max.call({maxCap:cap,lastSpinData:{game:{totalWinnings:win}}})}});
};
