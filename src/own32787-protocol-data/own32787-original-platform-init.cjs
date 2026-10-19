"use strict";
const fixed=require('./own32787-original-platform-init-DATA.json');
exports.createOwn32787OriginalPlatformInit=function({DOM,vm,game,need}){
 need(fixed.schema==='own32787-fixed-original-platform-init-DATA-v1'&&game.gameId==='32787','FIXED_OWN_PLATFORM_DATA');
 const ctx=vm.createContext({exports:{}}),literal=s=>new vm.Script('('+s+')').runInContext(ctx,{timeout:100});
 for(const name of ['PlatformInitData','GLSResponseHeader'])new vm.Script(fixed.classes[name].source).runInContext(ctx,{timeout:100});
 ctx.CurrencyFormatXMLParser={parse:literal(fixed.CurrencyFormatXMLParser.parse.source),DEFAULT_FORMAT:literal(fixed.CurrencyFormatXMLParser.DEFAULT_FORMAT.source)};
 const parsePlatformData=literal(fixed.parsePlatformData.callableSource);
 return Object.freeze({parseAcceptedPages(pages){
  need(Array.isArray(pages)&&pages.length>0,'COMPLETE_ORIGINAL_INIT_PAGES');let first,sid,scope,platformDocument,explicitMultiplier;
  for(let index=0;index<pages.length;index++){
   const frame=pages[index];need(frame?.game===game&&frame.msgId==='Init'&&frame.requestedPage===index&&frame.step?.msgId==='Init'&&frame.step.responsePayload===frame.responsePayload&&frame.step.requestPayload===frame.requestPayload,'ACCEPTED_ORIGINAL_PLATFORM_FRAME');
   const doc=new DOM.DOMParser().parseFromString(frame.responsePayload,'text/xml'),root=doc.documentElement,headers=doc.getElementsByTagName('Header'),page=doc.getElementsByTagName('Page'),info=doc.getElementsByTagName('PageInfo');
   need(root?.nodeName==='GameResponse'&&root.getAttribute('type')==='Init'&&!doc.getElementsByTagName('Error').length&&!doc.getElementsByTagName('Errors').length&&!doc.getElementsByTagName('parsererror').length&&headers.length===1&&page.length===1&&info.length===1,'ACTUAL_PLATFORM_INIT_ENVELOPE');
   const header=headers[0];need(header.getAttribute('gameID')==='20118'&&header.getAttribute('versionID')==='1_0'&&header.getAttribute('isRecovering')==='N'&&page[0].getAttribute('pageIndex')===String(index)&&info[0].getAttribute('pageCount')===String(pages.length),'ALL_REAL_ORIGINAL_INIT_PAGES');
   if(index===0){first=doc;sid=header.getAttribute('sessionID');scope=frame.sessionScope;need(typeof sid==='string'&&sid.length>0&&scope,'ACTUAL_PLATFORM_INIT_SCOPE')}
   const currency=doc.getElementsByTagName('CurrencyMultiplier');if(currency.length){need(currency.length===1&&currency[0].textContent.trim()!==''&&Number.isSafeInteger(Number(currency[0].textContent))&&Number(currency[0].textContent)>0,'ACTUAL_OWN_INIT_CURRENCY');const value=Number(currency[0].textContent);if(explicitMultiplier!==undefined)need(explicitMultiplier===value,'SAME_ACTUAL_OWN_INIT_CURRENCY');explicitMultiplier=value;platformDocument=doc}
   need(frame.sessionScope===scope&&header.getAttribute('sessionID')===sid,'SAME_ORIGINAL_PLATFORM_INIT_SESSION');
   if(index>0){const request=new DOM.DOMParser().parseFromString(frame.requestPayload,'text/xml'),h=request.getElementsByTagName('Header');need(h.length===1&&h[0].getAttribute('sessionID')===sid,'SAME_ORIGINAL_PLATFORM_REQUEST_SESSION')}
  }
  const platform=parsePlatformData(platformDocument||first),multiplier=platform.getCurrencyMultiplier(),format=platform.getCurrencyFormat();
  need(platform.getSessionId()===sid&&platform.getGameId()==='20118'&&platform.getVersion()==='1_0'&&platform.getIsRecovering()===false,'REAL_NATIVE_PLATFORM_IDENTITY');
  need(Number.isSafeInteger(multiplier)&&multiplier>0&&format&&typeof format.name==='string','REAL_NATIVE_PLATFORM_CURRENCY_CONTEXT');
  if(explicitMultiplier!==undefined)need(multiplier===explicitMultiplier,'ORIGINAL_EXPLICIT_PLATFORM_CURRENCY');
  Object.freeze(format);return Object.freeze(platform);
 }});
};
