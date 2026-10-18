'use strict';
const DOM=require('../own32769-node-dom.cjs'),vm=require('node:vm'),data=require('./source-DATA.json');
exports.create=d=>require('./own32751-original-SG-connection.cjs').create({...d,DOM,vm,data,createFlow:()=>require('./own32751-paged-wire-DATA.cjs').createOwn32751PagedWireDATA({DOM,vm,data})});
