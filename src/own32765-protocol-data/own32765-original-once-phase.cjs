'use strict';
// DATA connection to the original transport's accepted frames. No I/O or dispatch.
const assert = require('node:assert/strict');

exports.createOwn32765OriginalOncePhase = function(options) {
  const {game, sessionScope, source, readEnvelopeFrame, selectInitial, selectCurrent} = options;
  assert.equal(game.gameId, '32765');
  assert.equal(game.dbName, 'sg_dropandlockdeepseamagic');
  assert.equal(game.sg.runtimeGameId, 32987);
  assert(sessionScope && source && typeof source.has === 'function');
  assert.equal(typeof source.readCurrent, 'function');
  assert.equal(typeof readEnvelopeFrame, 'function');
  assert.equal(typeof selectInitial, 'function');
  assert.equal(typeof selectCurrent, 'function');
  const rounds = new WeakMap(), tickets = new WeakMap(), phases = new WeakMap(), acceptedEnds = new WeakSet();
  let currentRound = null;
  const hold = message => {
    throw Object.assign(new Error('own32765 original once phase hold: ' + message), {retryAllowed:false});
  };
  function checkFrame(frame, roundScope) {
    if (!frame || frame.game !== game || frame.sessionScope !== sessionScope || frame.roundScope !== roundScope)
      hold('original frame identity');
    if (!source.has(frame) || source.readCurrent(sessionScope,roundScope) !== frame || readEnvelopeFrame() !== frame)
      hold('current original readEnvelope frame required');
    if (!(frame.httpStatus >= 200 && frame.httpStatus < 300) || typeof frame.responsePayload !== 'string')
      hold('original successful envelope required');
  }
  function prepare(frame, roundScope, first) {
    checkFrame(frame,first ? frame?.roundScope : roundScope);
    let state = rounds.get(roundScope);
    if (first) {
      if (state) hold('one initial native entry per original round');
      if (currentRound) {
        if (!currentRound.ended || currentRound.frame!==frame || !acceptedEnds.has(frame))
          hold('next original round requires its own accepted previous End');
      } else if (frame.msgId!=='Init') hold('first session entry requires actual Init');
      state = {frame, pending:null, inFlight:null, sealed:null, ended:false};
      rounds.set(roundScope,state);currentRound=state;
    } else if (!state || state.frame !== frame || !phases.has(frame)) hold('accepted original request phase required');
    if (state.sealed || state.ended || state.pending || state.inFlight) hold('original once owner retained');
    const descriptor = first ? selectInitial(frame) : selectCurrent(frame);
    if (!descriptor || descriptor.kind !== 'request') hold(descriptor?.reason || 'native request not selected');
    if (descriptor.event !== 'Logic' && descriptor.event !== 'EndGame') hold('unmapped native request event');
    if (first && descriptor.event !== 'Logic') hold('initial own native Logic required');
    const nextPhase = first ? 'parent' : descriptor.nextPhase;
    if (descriptor.event === 'Logic' && (typeof nextPhase !== 'string' || !nextPhase)) hold('source descriptor nextPhase required');
    const ticket = Object.freeze({});
    const data = {state, frame, roundScope, first, event:descriptor.event,
      parameters:structuredClone(descriptor.parameters), nextPhase, rawRequest:null, consumed:false, committed:false};
    tickets.set(ticket,data);state.pending=ticket;
    return Object.freeze({ticket, event:data.event, action:descriptor.action,
      parameters:structuredClone(data.parameters), requestNotSent:true, actualEndACK:false});
  }
  function ownTicket(ticket) {
    const data=tickets.get(ticket);
    if (!data || data.state.sealed || data.state.ended) hold('own original ticket/owner');
    return data;
  }
  return Object.freeze({
    prepareInitial(frame,roundScope) {return prepare(frame,roundScope,true);},
    prepareNext(frame,roundScope) {return prepare(frame,roundScope,false);},
    consume(ticket,event,parameters) {
      const d=ownTicket(ticket);checkFrame(d.frame,d.first ? d.frame.roundScope : d.roundScope);
      if (d.consumed || d.state.pending!==ticket || d.state.inFlight) hold('single original consume');
      assert.equal(event,d.event);assert.deepEqual(parameters,d.parameters);
      d.consumed=true;d.state.pending=null;d.state.inFlight=ticket;
      return Object.freeze({event:d.event,parameters:structuredClone(d.parameters)});
    },
    bindOriginalSerializedRequest(ticket,rawRequest) {
      const d=ownTicket(ticket);
      if (!d.consumed || d.state.inFlight!==ticket || d.rawRequest!==null || typeof rawRequest!=='string' || !rawRequest)
        hold('one actual original serialized request');
      d.rawRequest=rawRequest;
    },
    commitAccepted(ticket,frame) {
      const d=ownTicket(ticket);
      if (!d.consumed || d.committed || d.state.inFlight!==ticket || d.rawRequest===null) hold('single original accepted response');
      checkFrame(frame,d.roundScope);
      if (frame===d.frame || frame.msgId!==d.event || frame.requestPayload!==d.rawRequest || phases.has(frame))
        hold('accepted frame must bind the original sent request');
      d.committed=true;d.state.inFlight=null;d.state.frame=frame;
      if (d.event==='Logic') phases.set(frame,d.nextPhase);
      else {d.state.ended=true;acceptedEnds.add(frame);}
      return Object.freeze({acceptedEvent:d.event,requestPhase:d.event==='Logic'?d.nextPhase:undefined,
        transportOrEndAcceptanceClaimedByThisModule:false});
    },
    readRequestPhase(frame) {return phases.get(frame);},
    sealUnknown(ticket,reason) {
      const d=tickets.get(ticket);if(!d)hold('unknown original ticket');
      d.state.sealed=reason || new Error('original outcome unknown');
    },
    status(roundScope) {
      const s=rounds.get(roundScope);
      return Object.freeze({present:!!s,prepared:!!s?.pending,inFlight:!!s?.inFlight,
        sealed:!!s?.sealed,acceptedTerminalFrame:!!s?.ended,sourceRequests:0,DBWrites:0});
    }
  });
};
