'use strict';
const DOM=require('../own32769-node-dom.cjs'),vm=require('node:vm'),data=require('./selected-original-SG-connection-DATA-v2.json');
const {createOwn32772SelectedProtocolNext:createProtocol}=require('./own32772-selected-protocol-next-DATA.cjs');
const {createOwn32772OriginalSGConnection:create}=require('./own32772-original-SG-protocol-connection.cjs');
exports.createOwn32772OriginalSGConnection=d=>create({...d,DOM,vm,data,createProtocol});
