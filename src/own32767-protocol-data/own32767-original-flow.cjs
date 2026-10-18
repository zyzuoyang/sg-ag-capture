'use strict';
exports.createOwn32767OriginalFlow=function({DOM,vm,data,game,createProtocol,need}){
 const protocol=createProtocol({DOM,vm,data:data.protocol});
 const server={PlatformData:function(){}},ctx=vm.createContext({server});
 const literal=name=>new vm.Script('('+data.wire[name].source+')').runInContext(ctx,{timeout:100});
 const Header=literal('headerConstructor');Header.prototype.parse=literal('headerXML');server.GLSHeader=Header;
 const serializers={Init:literal('requestInit'),Logic:literal('requestLogic'),EndGame:literal('requestEnd')},platformParser=literal('platform');
 let platform=null,current=null,stage='base',freeTotal=null;
 const normal=()=>({wager:game.sg.betRaw,currencyMultiplier:platform?.currencyMultiplier,historyReplay:false,force:false});
 return Object.freeze({
  wire(event,sid){need(event==='Init'||platform,'actual native Init currency');const body=protocol.normalRequest(event,normal()).encoderBody;
   const meta={isRealMoney:()=>game.sg.header.freePlay!=='Y',getGameCode:()=>game.sg.header.gameCodeRGI,getLocale:()=>game.sg.header.lang},session={getContextID:()=>game.sg.header.affiliate,getPlayerID:()=>game.sg.header.userID};
   return serializers[event].call({_metaData:meta,_partnerAdapter:{getSessionData:()=>session},_sessionId:sid,_glmId:game.sg.header.gameID,_glmVersion:game.sg.header.versionID},{getEncoders:()=>body?[{parse:()=>body}]:[]});
  },
  init(raw){const doc=new DOM.DOMParser().parseFromString(raw,'text/xml'),result={};platformParser.call({},doc,result);platform=result.platformData;need(platform&&doc.documentElement.getAttribute('type')==='Init'&&doc.getElementsByTagName('Header')[0].getAttribute('isRecovering')==='N'&&platform.gameId==='20192'&&platform.version==='1_0'&&Number.isSafeInteger(platform.currencyMultiplier)&&platform.currencyMultiplier>0,'own original platform Init');const stakes=doc.getElementsByTagName('Stakes');need(stakes.length===1&&stakes[0].textContent.split('|').map(Number).includes(game.sg.betRaw),'own native menu');},
  begin(){current=null;stage='base';freeTotal=null},
  next(raw){const scope={},frame=Object.freeze({msgId:'Logic',httpStatus:200,responsePayload:raw}),source={readCurrent:s=>s===scope?frame:null,has:x=>x===frame,readNormalCaptureMode:s=>s===scope?'normal-capture':null};
   const mapped=protocol.inspect({sessionScope:scope,source,frame});let event,free;
   if(mapped.sourceRoute==='own-free-intro-to-native-Logic'){need(stage==='base','one own source free intro');stage='free';freeTotal=mapped.sourceTotal}else if(mapped.sourceRoute.includes('own-free-'))need(stage==='free','own current free parent');
   if(mapped.sourceRoute==='own-ordinary-post-win-End'||mapped.sourceRoute==='own-free-outro-to-native-End')event='EndGame';
   else if(mapped.sourceRoute==='own-free-intro-to-native-Logic'||mapped.sourceRoute==='own-free-after-native-presentation-to-Logic')event='Logic';
   else need(false,'unmapped actual own source route');
   if(mapped.sourceRemaining!==undefined){need(Number.isSafeInteger(freeTotal)&&freeTotal>=mapped.sourceRemaining,'own explicit intro total retained');const played=freeTotal-mapped.sourceRemaining;need(!current||played>current.freeSpinsPlayed,'advancing original free counters');free=Object.freeze({freeSpinsTotal:freeTotal,freeSpinsPlayed:played,freeSpinsRemaining:mapped.sourceRemaining,accumulativeWin:mapped.sourceFreeWin/100});current=free}
   return Object.freeze({event,action:event==='Logic'?'FREE_SPIN':'PLAY',sourceCumulativeWin:mapped.sourceCumulativeWin,...(free?{free}:{}),sourceRoute:mapped.sourceRoute});
  },
  acceptedEnd(){current=null;stage='base';freeTotal=null}
 });
};