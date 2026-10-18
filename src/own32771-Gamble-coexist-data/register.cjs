'use strict';
const DOM=require('../own32769-node-dom.cjs'),vm=require('node:vm'),sourceData=require('./own32771-native-Gamble-source-DATA.json'),{createOwn32771NativeGambleProtocol:createNativeProtocol}=require('./own32771-native-Gamble-protocol.cjs'),{createOwn32771GambleCoexist:create}=require('./own32771-Gamble-coexist-sidecar.cjs');
exports.createOwn32771OriginalSGCoexist=options=>create({...options,DOM,vm,sourceData,createNativeProtocol});
