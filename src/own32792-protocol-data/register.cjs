'use strict';
const DOM=require('../own32769-node-dom.cjs'),vm=require('node:vm'),data=require('./original-SG-connection-DATA-v1.json');
const {createOwn32792ProtocolDATA:createProtocol}=require('./own32792-selected-protocol-DATA.cjs');
const {createOwn32792OriginalSGConnection:create}=require('./own32792-original-SG-connection.cjs');
exports.createOwn32792OriginalSGConnection=d=>create({...d,DOM,vm,data,createProtocol});
