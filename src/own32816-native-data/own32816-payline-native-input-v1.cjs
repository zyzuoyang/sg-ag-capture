'use strict';
const assert=require('node:assert/strict');

/* Own32816 UI input DATA only. Never invoke a game event, mediator or FSM API. */
exports.createOwn32816PaylineNativeInput=function createOwn32816PaylineNativeInput(d) {
  for(const key of ['readHost','assertOriginalOpen','assertActiveOriginalPaidIntent','assertCurrentAcceptedLogic'])
    assert.equal(typeof d[key],'function','OWN32816_PAYLINE_INPUT_DEPENDENCY '+key);
  const attempted=new WeakMap(),nativeResponses=new WeakMap();
  let sealed=false,waits=0,attempts=0,dispatched=0,unknown=0;
  const wait=reason=>{waits++;return Object.freeze({status:'wait',reason});};
  function one(entries,Original,name) {
    assert.equal(typeof Original,'function','OWN32816_PAYLINE_INPUT_ORIGINAL_TYPE '+name);
    const rows=entries.filter(x=>x.instance instanceof Original);
    assert.equal(rows.length,1,'OWN32816_PAYLINE_INPUT_ONE_ORIGINAL_INSTANCE '+name);
    assert.equal(Object.getPrototypeOf(rows[0].instance),Original.prototype,'OWN32816_PAYLINE_INPUT_ORIGINAL_PROTOTYPE '+name);
    return rows[0].instance;
  }
  function method(value,original,name) {
    assert.equal(typeof original,'function','OWN32816_PAYLINE_INPUT_ORIGINAL_METHOD '+name);
    assert.equal(value,original,'OWN32816_PAYLINE_INPUT_METHOD_IDENTITY '+name);
  }
  function ancestorOf(ancestor,node) {
    const seen=new Set();
    while(node){assert(!seen.has(node)&&seen.size<64,'OWN32816_PAYLINE_INPUT_FINITE_PARENT_CHAIN');if(node===ancestor)return true;seen.add(node);node=node.parent;}
    return false;
  }
  return Object.freeze({
    tryMouseDown({paidIntent,delivery}) {
      assert(!sealed,'OWN32816_PAYLINE_INPUT_SEALED');d.assertOriginalOpen();
      assert(paidIntent&&typeof paidIntent==='object'&&delivery&&typeof delivery==='object','OWN32816_PAYLINE_INPUT_ORIGINAL_CAPABILITIES');
      d.assertActiveOriginalPaidIntent(paidIntent);
      d.assertCurrentAcceptedLogic(delivery);
      if(attempted.has(delivery))return Object.freeze({status:'already-attempted',outcome:attempted.get(delivery).outcome});
      const h=d.readHost(),c=h?.context,g=c?.sgigame,r=c?.rendering,j=c?.createjs,main=h?.outerGame?.main;
      assert(h&&!h.disposed&&g&&r&&j,'OWN32816_PAYLINE_INPUT_ORIGINAL_HOST');
      assert.equal(Object.getPrototypeOf(h.outerGame),c.zeus3_prt?.Game?.prototype,'OWN32816_PAYLINE_INPUT_OWN_WRAPPER');
      assert.equal(Object.getPrototypeOf(main),g.Main?.prototype,'OWN32816_PAYLINE_INPUT_OWN_MAIN');
      assert(Array.isArray(h.pending)&&h.pending.length===0,'OWN32816_PAYLINE_INPUT_NO_PENDING_REQUEST');
      assert(Array.isArray(h.errors)&&h.errors.length===0,'OWN32816_PAYLINE_INPUT_HEALTHY_HOST');
      const entries=main._context?.injector?.singletonMap;assert(Array.isArray(entries),'OWN32816_PAYLINE_INPUT_ORIGINAL_INJECTOR');
      const model=one(entries,g.GameStateModel,'GameStateModel');
      method(model.getCurrentState,g.GameStateModel.prototype.getCurrentState,'getCurrentState');
      method(model.getSubGame,g.GameStateModel.prototype.getSubGame,'getSubGame');
      if(![g.BaseGameStates.SHOW_PAYLINE_WINS_STATE,g.BaseGameStates.FS_SHOW_PAYLINE_WINS_STATE].includes(model.getCurrentState()?.stateName)||model.getSubGame()!==g.SubGames.BASE_GAME)
        return Object.freeze({status:'not-applicable'});
      const server=one(entries,g.ServerController,'ServerController');
      method(server.getLogicResponse,g.ServerController.prototype.getLogicResponse,'getLogicResponse');
      const response=server.getLogicResponse();
      assert(response instanceof g.GameLogicResponse&&Object.getPrototypeOf(response)===g.GameLogicResponse.prototype,'OWN32816_PAYLINE_INPUT_CURRENT_NATIVE_LOGIC_TYPE');
      if(nativeResponses.has(delivery))assert.equal(nativeResponses.get(delivery),response,'OWN32816_PAYLINE_INPUT_CURRENT_LOGIC_IDENTITY');
      else nativeResponses.set(delivery,response);
      const subgames=one(entries,g.SubGamesModel,'SubGamesModel'),view=subgames.reelsLayer;
      if(!view)return wait('actual-original-reels-layer-not-mounted');
      assert(view instanceof g.LayerView&&Object.getPrototypeOf(view)===g.LayerView.prototype,'OWN32816_PAYLINE_INPUT_ORIGINAL_LAYER_TYPE');
      method(view.getNativeDisplayObject,r.DisplayObject.prototype.getNativeDisplayObject,'layer.getNativeDisplayObject');
      method(view.onDown,r.DisplayObject.prototype.onDown,'original-rendering-onDown');
      if(!view.visible||view._interactive!==true||view._listenersAdded!==true)return wait('actual-layer-not-visible-interactive-attached');
      const eventIndex=Array.isArray(view._eventNames)?view._eventNames.indexOf(r.InputEvent.DOWN):-1;
      if(eventIndex<0)return wait('original-layer-DOWN-listener-not-attached');
      const listeners=view._listeners?.[eventIndex],contexts=view._listenerContexts?.[eventIndex];
      assert(Array.isArray(listeners)&&Array.isArray(contexts)&&listeners.length===contexts.length,'OWN32816_PAYLINE_INPUT_ORIGINAL_LISTENER_REGISTRY');
      if(listeners.length!==1||listeners[0]!==g.LayerMediator.prototype.onDown||
         !(contexts[0] instanceof g.LayerMediator)||Object.getPrototypeOf(contexts[0])!==g.LayerMediator.prototype||contexts[0].view!==view)
        return wait('original-layer-mediator-not-bound-to-actual-layer');
      const native=view.getNativeDisplayObject();
      assert(native instanceof j.Container&&Object.getPrototypeOf(native)===j.Container.prototype,'OWN32816_PAYLINE_INPUT_ORIGINAL_CREATEJS_CONTAINER');
      const stageWrapper=view.stage;
      if(!stageWrapper)return wait('actual-stage-not-attached');
      assert(stageWrapper instanceof r.Stage,'OWN32816_PAYLINE_INPUT_ORIGINAL_RENDERING_STAGE');
      method(stageWrapper.getNativeDisplayObject,r.Stage.prototype.getNativeDisplayObject,'stage.getNativeDisplayObject');
      const stage=stageWrapper.getNativeDisplayObject();
      assert(stage instanceof j.Stage,'OWN32816_PAYLINE_INPUT_ORIGINAL_CREATEJS_STAGE');
      if(!ancestorOf(stage,native))return wait('actual-target-not-on-stage');
      for(let node=native;node;node=node.parent){
        if(node.visible!==true||!Number.isFinite(node.alpha)||node.alpha<=0||node.scaleX===0||node.scaleY===0||node.mouseEnabled===false)
          return wait('actual-target-or-ancestor-not-visible-enabled');
        if(node===stage)break;
      }
      method(native.getBounds,j.Container.prototype.getBounds,'native.getBounds');
      method(native.localToGlobal,j.DisplayObject.prototype.localToGlobal,'native.localToGlobal');
      method(native.hasEventListener,j.EventDispatcher.prototype.hasEventListener,'native.hasEventListener');
      if(!native.hasEventListener('mousedown'))return wait('original-native-mousedown-listener-not-attached');
      const bounds=native.getBounds();
      if(!bounds||![bounds.x,bounds.y,bounds.width,bounds.height].every(Number.isFinite)||bounds.width<=0||bounds.height<=0)
        return wait('actual-hit-geometry-not-ready');
      method(stage.globalToLocal,j.DisplayObject.prototype.globalToLocal,'stage.globalToLocal');
      method(stage.getObjectUnderPoint,j.Container.prototype.getObjectUnderPoint,'stage.getObjectUnderPoint');
      // A real layer hit must not also activate a child button/interactive view.
      const childInputs=[],queue=[...view.children],seen=new Set();
      while(queue.length){
        const node=queue.shift();assert(node instanceof r.DisplayObject&&!seen.has(node)&&seen.size<2048,'OWN32816_PAYLINE_INPUT_FINITE_ACTUAL_VIEW_TREE');seen.add(node);
        const index=Array.isArray(node._eventNames)?node._eventNames.indexOf(r.InputEvent.DOWN):-1;
        if(index>=0&&node._listeners?.[index]?.length)childInputs.push(node.getNativeDisplayObject());
        if(Array.isArray(node.children))queue.push(...node.children);
      }
      let position,target;
      for(const [fx,fy] of [[.5,.5],[.25,.5],[.75,.5],[.5,.25],[.5,.75],[.25,.25],[.75,.25],[.25,.75],[.75,.75]]){
        const point=native.localToGlobal(bounds.x+bounds.width*fx,bounds.y+bounds.height*fy),p=stage.globalToLocal(point.x,point.y);
        if(![p.x,p.y,stage.canvas?.width,stage.canvas?.height].every(Number.isFinite)||p.x<0||p.y<0||p.x>=stage.canvas.width||p.y>=stage.canvas.height)continue;
        const hit=stage.getObjectUnderPoint(p.x,p.y,2);
        if(!hit||!ancestorOf(native,hit)||childInputs.some(n=>ancestorOf(n,hit)))continue;
        position=p;target=hit;break;
      }
      if(!target)return wait('actual-layer-hit-unavailable-or-child-input');
      method(target.dispatchEvent,j.EventDispatcher.prototype.dispatchEvent,'original-createjs-dispatchEvent');
      const event=new j.MouseEvent('mousedown',true,false,position.x,position.y,null,-1,true,position.x,position.y);
      assert.equal(Object.getPrototypeOf(event),j.MouseEvent.prototype,'OWN32816_PAYLINE_INPUT_ORIGINAL_MOUSE_EVENT');
      /* Mark BEFORE input. A throwing input is retained unknown and never retried. */
      const record={outcome:'input-started'};attempted.set(delivery,record);attempts++;
      try{target.dispatchEvent(event);record.outcome='native-mousedown-dispatched';dispatched++;}
      catch(error){record.outcome='input-execution-unknown';unknown++;sealed=true;throw error;}
      return Object.freeze({status:'dispatched',eventType:'mousedown',originalCreateJSMouseEvent:true,originalHitTestTarget:true,
        stageX:position.x,stageY:position.y,gameEventDirectDispatch:false,gameStateWrites:false});
    },
    seal(){sealed=true;},
    status(){return {schema:'own32816-payline-native-input-v1',sealed,waits,attempts,dispatched,unknown,
      oncePerAcceptedLogicDelivery:true,gameEventDirectDispatch:false,gameStateWrites:false,productionReady:false};}
  });
};
