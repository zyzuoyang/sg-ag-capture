'use strict';
const DOM=require('../own32769-node-dom.cjs'),vm=require('node:vm'),data=require('./selected-original-SG-connection-DATA-v1.json');
const {createOwn32766SelectedProtocol:createProtocol}=require('./own32766-selected-protocol-DATA.cjs');
const {createOwn32766OriginalSGConnection:create}=require('./own32766-original-SG-protocol-connection.cjs');
exports.createOwn32766OriginalSGConnection=d=>create({...d,DOM,vm,data,createProtocol});
