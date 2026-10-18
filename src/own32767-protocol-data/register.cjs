'use strict';
const DOM=require('../own32769-node-dom.cjs'),vm=require('node:vm'),data=require('./original-SG-connection-DATA-v1.json');
const {createOwn32767ProtocolDATA:createProtocol}=require('./own32767-selected-protocol-DATA.cjs');
const {createOwn32767OriginalSGConnection:create}=require('./own32767-original-SG-connection.cjs');
exports.createOwn32767OriginalSGConnection=d=>create({...d,DOM,vm,data,createProtocol});
