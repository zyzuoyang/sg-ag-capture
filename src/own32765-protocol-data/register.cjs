'use strict';
const vm=require('node:vm'),DOM=require('../own32769-node-dom.cjs');
const {createOwn32765OriginalSGConnection}=require('./own32765-original-SG-connection.cjs');
exports.createOwn32765OriginalSGConnection=options=>createOwn32765OriginalSGConnection({...options,DOM,vm,
 modelData:require('./own32765-Init-DL-model-source-DATA.json'),parentData:require('./Free-parent-continuation-source-DATA-v4.json'),bindingData:require('./current-feature-frame-source-DATA-v2.json')});
