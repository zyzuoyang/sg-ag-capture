'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const DOM=require('../own32769-node-dom.cjs');
const data=require('./source-DATA.json');
const sharedSource=fs.readFileSync(path.join(__dirname,'own-gls-comms.js'),'utf8');
const {createOwn32789OriginalSGConnection}=require('./own32789-original-SG-connection.cjs');
exports.createOwn32789OriginalSGConnection=d=>createOwn32789OriginalSGConnection({...d,DOM,data,vm,sharedSource});
