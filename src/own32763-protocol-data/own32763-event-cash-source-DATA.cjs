"use strict";
// An event-scoped own money DATA reader, never a request/End/round authority.
exports.readOwn32763EventCash=function({doc,game,event,acceptedSID,strictAccountDataCash,need}){
 need(game?.gameId==='32763'&&game.dbName==='sg_drjekyllgoeswild'&&game.sg?.runtimeGameId===32985&&game.sg.header?.gameID==='20126','own cash identity');
 need(['Init','Logic','EndGame'].includes(event),'own cash protocol event');
 const root=doc?.documentElement;
 need(root?.nodeName==='GameResponse'&&root.getAttribute('type')===event,'own cash exact envelope event');
 const children=(node,name)=>Array.from(node?.childNodes||[]).filter(n=>n.nodeType===1&&n.nodeName===name);
 const headers=children(root,'Header');need(headers.length===1&&doc.getElementsByTagName('Header').length===1,'one own cash Header');
 const h=headers[0];need(h.getAttribute('gameID')==='20126'&&h.getAttribute('versionID')==='1_0'&&h.getAttribute('isRecovering')==='N','own cash Header identity');
 const sid=h.getAttribute('sessionID');need(typeof acceptedSID==='string'&&acceptedSID.length>0&&sid===acceptedSID,'own cash accepted raw SID');
 const ccy=h.getAttribute('ccyCode');need(typeof game.sg.header.ccyCode==='string'&&ccy!==null&&ccy===game.sg.header.ccyCode,'own cash actual currency');
 const direct=children(root,'Balances');need(direct.length<=1,'own cash duplicate direct container');
 const accountNodes=Array.from(doc.getElementsByTagName('AccountData'));
 const accountContainers=accountNodes.flatMap(a=>children(a,'Balances'));
 need(accountContainers.length<=1,'own cash duplicate AccountData container');
 need((direct.length===1)!==(accountContainers.length===1),'own cash unique explicit layout');
 let box;
 if(direct.length===1){box=direct[0];}
 else{
  const directAccounts=children(root,'AccountData');
  need(directAccounts.length===1&&children(directAccounts[0],'Balances').length===1&&children(directAccounts[0],'Balances')[0]===accountContainers[0],'own cash exact AccountData layout');
  box=accountContainers[0];
 }
 const cash=children(box,'Balance').filter(n=>n.getAttribute('name')==='CASH_BALANCE');
 const all=Array.from(doc.getElementsByTagName('Balance')).filter(n=>n.getAttribute('name')==='CASH_BALANCE');
 need(cash.length===1&&all.length===1&&cash[0]===all[0],'one own actual CASH_BALANCE');
 for(const key of ['ccyCode','currency']){const v=cash[0].getAttribute(key);need(v===null||v===ccy,'own cash node currency');}
 const raw=cash[0].getAttribute('value');need(typeof raw==='string'&&/^[0-9]+$/.test(raw),'own cash integer text');
 const value=Number(raw);need(Number.isSafeInteger(value)&&value>=0,'own cash safe nonnegative integer');
 if(accountContainers.length){need(typeof strictAccountDataCash==='function'&&strictAccountDataCash(doc)===value,'own original AccountData cash agrees');}
 return value;
};
