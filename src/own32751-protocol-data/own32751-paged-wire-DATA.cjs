'use strict';
// Own protocol DATA only. Transport, AG rounds, replay, quota and Mongo remain external.
exports.createOwn32751PagedWireDATA=function({DOM,vm,data}){
 const need=(ok,why)=>{if(!ok)throw Object.assign(new Error('OWN32751_PROTOCOL_HOLD_'+why),{own32751ProtocolHold:true,newRequestNotSent:true,retryAllowed:false})};
 need(DOM?.DOMParser&&vm?.Script&&data?.schema==='own32751-original-paged-Init-and-source-request-DATA-v1356','FIXED_OWN_SOURCE');
 const c=vm.createContext({k:{Mi:0,Bx:1,Nr:2},y:Object.assign,E:{P:{Ja:{pc:{ea:{Mi:0,Bx:1,Nr:2}},sa:{ea:{so:0}}},ga:{mc:{fe:'opaque-display-input-token'}}},J:{KS:{GBP:{}},HP:{qX:''}},F:{Mc:x=>typeof x==='string'},fc:{get:()=>({gN:1})},Pu:{sb:0}},a:{Utils:{Array:{}}}});
 const leaf=n=>new vm.Script('('+data.leaves[n].source+')').runInContext(c,{timeout:500}),last=leaf('ownLastArrayEntry');c.a.Utils.Array.NSa=a=>last(a,0);
 const credit=leaf('creditToTotal'),selected=leaf('selectedStake');c.E.P.Ja.pc.uh=credit;c.E.P.Ja.pc.zC=(a,k)=>{need(k===0,'OWN_TOTAL_STAKE_TYPE');return credit(a,selected(a)).value};
 const Wma=leaf('ownWma'),aOa=leaf('aOa'),baseS3=leaf('s3');c.f={prototype:{s3:baseS3}};const s3=leaf('ownS3'),inputMode=leaf('actualModeInputSetter'),currency=leaf('ONa'),free=leaf('kSa'),canClose=leaf('Era');
 const children=(n,name)=>Array.from(n.childNodes||[]).filter(x=>x.nodeType===1&&x.nodeName===name),one=(n,name)=>{const a=children(n,name);need(a.length===1,'ONE_'+name);return a[0]},attr=(n,k)=>{const a=n?.attributes?.getNamedItem(k);need(a!=null,'EXPLICIT_'+k);return a.value};
 const int=(n,k)=>{need(/^-?(?:0|[1-9]\d*)$/.test(String(n))&&Number.isSafeInteger(Number(n)),k);return Number(n)},positive=(n,k)=>{const a=int(n,k);need(a>0,k);return a};
 const parse=(text,rootName,type)=>{need(typeof text==='string'&&text.length>0&&!/<!DOCTYPE/i.test(text),'RAW_XML');const d=new DOM.DOMParser().parseFromString(text,'text/xml'),r=d.documentElement;need(r?.nodeName===rootName&&attr(r,'type')===type&&!d.getElementsByTagName('parsererror').length&&!d.getElementsByTagName('Error').length&&!d.getElementsByTagName('Errors').length,'SUCCESSFUL_'+type);return{d,r}};
 const header=(h,request=false)=>need(attr(h,'gameID')==='20371'&&attr(h,'versionID')==='1_0'&&(!request||attr(h,'gameCodeRGI')==='eightyeightfortunesmegaways'),'OWN_HEADER');
 let state=null,lastCursor=null,issued=null,sealed=false;
 const open=()=>need(!sealed,'SEALED');
 function build(event,total,mode,cursor){const d=new DOM.DOMParser().parseFromString('<GameRequest/>','text/xml'),r=d.documentElement;r.setAttribute('type',event);const h=d.createElement('Header');for(const[k,v]of Object.entries(state.header))h.setAttribute(k,v);h.setAttribute('sessionID',cursor);h.setAttribute('ccyCode',state.model.Hj.mw);r.appendChild(h);
  if(event==='Logic'){const account=d.createElement('AccountData'),m=d.createElement('CurrencyMultiplier');m.appendChild(d.createTextNode(String(state.model.Hj.Pd)));account.appendChild(m);r.appendChild(account);const stake=d.createElement('Stake');stake.setAttribute('total',String(total));stake.setAttribute('gameMode',String(mode));r.appendChild(stake)}
  return new DOM.XMLSerializer().serializeToString(d)}
 return Object.freeze({
  initializeFromAcceptedPages(pages){open();need(!state&&Array.isArray(pages)&&pages.length===2,'ONE_CURRENT_TWO_PAGE_INIT');let first=null,previous=null,baseHeader=null;
   for(let index=0;index<2;index++){const f=pages[index];need(f?.httpStatus===200&&f.msgId==='Init','ACTUAL_INIT_HTTP');const q=parse(f.requestPayload,'GameRequest','Init'),r=parse(f.responsePayload,'GameResponse','Init'),qh=one(q.r,'Header'),rh=one(r.r,'Header');header(qh,true);header(rh);need(attr(rh,'isRecovering')==='N','NONRECOVERY');need(int(attr(one(q.r,'Page'),'number'),'PAGE_INDEX')===index,'ORDERED_REAL_PAGE_REQUEST');
    const info=one(r.r,'PageInfo'),p=one(info,'Page');need(int(attr(info,'pageCount'),'SOURCE_PAGE_COUNT')===2&&int(attr(p,'pageIndex'),'SOURCE_PAGE_INDEX')===index,'OWN_PAGE_PAIR');
    need(!children(q.r,'REPLAY').length&&!children(q.r,'FORCE').length,'NORMAL_INIT_ROUTE');if(previous)need(attr(qh,'sessionID')===previous,'CONTINUOUS_CURRENT_CURSOR');
    if(!baseHeader)baseHeader=Object.fromEntries(Array.from(qh.attributes).map(a=>[a.name||a.nodeName,a.value]));
    else for(const k of ['affiliate','ccyCode','channel','freePlay','gameCodeRGI','gameID','glsID','lang','promotions','userID','userType','versionID'])need(attr(qh,k)===baseHeader[k],'SAME_INIT_COHORT_'+k);
    previous=attr(rh,'sessionID');need(previous.length>0,'ACCEPTED_INIT_CURSOR');if(index===0)first={r:r.r,p,h:rh};
   }
   const stakes=one(first.p,'Stakes'),values=stakes.textContent.split('|').map(Number),index=int(attr(stakes,'defaultIndex'),'SOURCE_DEFAULT_CREDIT');need(values.length>0&&values.every(x=>Number.isFinite(x)&&x>0)&&index>=0&&index<values.length,'ACTUAL_CREDIT_MENU');
   // PaylineCount is omitted only for the actual absent Paylines branch. A newly
   // present payline menu must be mapped before it can issue source requests.
   need(!children(first.p,'Paylines').length,'UNMAPPED_PRESENT_PAYLINE_MENU');
   const model={O:{Na:{},config:{ot:Array.from(data.fixedOwnCreditModes),uk:[]},state:{state:2},Zd:{}},XA:1,Hj:{},Wk:{jj:false},vq:[],Cn:{Cr(){},ZU(){}},Eb:{cc:{value:0}},yd:{Ed:{value:0}},sc:{format:String}};
   Wma.call(model,{hsa:values,NS:index});aOa.call(model,{Zpa:[]});const account=children(first.r,'AccountData');need(account.length<=1,'ONE_ACCOUNT');const infos=account.length?children(account[0],'CurrencyInformation'):[];need(infos.length<=1,'ONE_CURRENCY_INFO');let info;
   if(infos.length){const multiplier=one(infos[0],'CurrencyMultiplier');info={Pd:positive(multiplier.textContent,'ACTUAL_MULTIPLIER')}}
   currency.call(model,{Yg:{uS:attr(first.h,'ccyCode')},Xk:info?{aja:info}:{}});need(Number.isSafeInteger(model.Hj.Pd)&&model.Hj.Pd>0,'SOURCE_CURRENCY_RESULT');
   const sourceDefaultMode=model.O.Na.Yi;inputMode.call(model,data.explicitCollectorModeIndex);const request=s3.call(model,{Zy:selected(model.O.Na),Pn:model.O.Na.Qj[model.O.Na.wi]});need(request.Ql===0&&request.Zy.value===16&&request.Pn===undefined,'EXPLICIT_OWN_COLLECTOR_SELECTION');
   state={model,header:baseHeader,paidTotal:request.Zy.value,mode:request.Ql};lastCursor=previous;
   return Object.freeze({initialBetRaw:16,explicitCollectorModeIndex:0,sourceDefaultMode,selectedOwnMode:model.O.Na.Yi,paylineCount:undefined,sourceCurrencyMultiplier:model.Hj.Pd,sourceRequests:0,productionReady:false});
  },
  initial(){open();need(state&&!issued,'CURRENT_INITIAL_READY');issued=Object.freeze({event:'Logic',requestPayload:build('Logic',state.paidTotal,state.mode,lastCursor)});return issued},
  acceptLogic(frame){open();need(state&&issued?.event==='Logic'&&frame.msgId==='Logic'&&frame.httpStatus===200&&frame.requestPayload===issued.requestPayload,'ONE_ISSUED_CURRENT_LOGIC');const{r}=parse(frame.responsePayload,'GameResponse','Logic'),h=one(r,'Header');header(h);need(attr(h,'isRecovering')==='N','NORMAL_LOGIC');const g=one(r,'GameResult'),bg=one(g,'BGInfo'),currentStake=positive(attr(g,'stake'),'SOURCE_CURRENT_STAKE'),win=int(attr(bg,'totalWagerWin'),'SOURCE_CUMULATIVE_WIN');need(win>=0,'NONNEGATIVE_SOURCE_WIN');
   const modeAttr=bg.attributes.getNamedItem('gameMode'),mode=modeAttr?int(modeAttr.value,'SOURCE_MODE'):0;need(mode>=0&&mode<data.fixedOwnCreditModes.length,'SOURCE_MODE_ENUM');
   const max=attr(bg,'isMaxWin');need(['0','1','false','true'].includes(max.toLowerCase()),'SOURCE_MAX_BOOLEAN');need(!['1','true'].includes(max.toLowerCase()),'MAX_METADATA_UNBOUND');const O={zb:{},state:{cl:false}},fs=children(g,'FSInfo');need(fs.length<=1,'ONE_OPTIONAL_FREE');
   if(fs.length){const f=fs[0],dto={};for(const[k,name]of Object.entries({hka:'freeSpinNumber',xC:'freeSpinsTotal',wH:'spinsUsed',zWa:'spinsRemaining',pLa:'fsWinnings',Cm:'extraSpinsAwarded'})){const a=f.attributes.getNamedItem(name);if(a)dto[k]=int(a.value,'SOURCE_FS_'+name)}need((dto.xC!==undefined&&dto.hka!==undefined)||dto.zWa!==undefined,'EXPLICIT_FREE_NEXT_COUNTER');free.call({O},dto);need(Number.isSafeInteger(O.zb.Ke)&&O.zb.Ke>=0,'SOURCE_FREE_REMAINING')}
   const terminal=canClose.call({O,ZTa:{jj:false}});lastCursor=attr(h,'sessionID');need(lastCursor.length>0,'ACCEPTED_LOGIC_CURSOR');issued=Object.freeze({event:terminal?'EndGame':'Logic',requestPayload:build(terminal?'EndGame':'Logic',currentStake,mode,lastCursor)});
   return Object.freeze({...issued,sourceCumulativeWin:win,sourceCurrentStake:currentStake,sourceFreeRemaining:O.zb.Ke,EndCandidate:terminal,newProviderACK:false,actualCurrentEndACKStillRequired:true});
  },
  acceptEnd(frame){open();need(issued?.event==='EndGame'&&frame.msgId==='EndGame'&&frame.httpStatus===200&&frame.requestPayload===issued.requestPayload,'ONE_CURRENT_END');const{r}=parse(frame.responsePayload,'GameResponse','EndGame'),h=one(r,'Header');header(h);need(attr(h,'isRecovering')==='N'&&!children(r,'GameResult').length,'NORMAL_SUCCESSFUL_END');lastCursor=attr(h,'sessionID');need(lastCursor.length>0,'ACCEPTED_END_CURSOR');issued=null;return Object.freeze({acceptedCurrentEndEnvelope:true,independentFinalCredit:0})},
  seal(){sealed=true},status(){return{initialized:!!state,pendingEvent:issued?.event,sealed,newSourceRequests:0,productionReady:false}}
 });
};
