'use strict';

// Private, disabled preparation. The existing original SG wire owner alone
// supplies consumed paid-intent and accepted-response capabilities.
exports.createOwn32816OriginalMainSelector = function(d) {
  const need = (ok, message) => { if (!ok) throw Error('OWN32816_NATIVE_SELECTOR_' + message); };
  for (const name of ['readHost', 'assertOriginalOpen', 'consumeOriginalPaidIntent',
    'assertOriginalAcceptedDelivery', 'readOriginalSessionID', 'wallNow', 'yieldNative']) {
    need(typeof d[name] === 'function', 'DEPENDENCY_' + name);
  }
  need(d.providerData && typeof d.providerData.captureCurrentNative === 'function', 'PRIVATE_V5_PORT');
  need(Number.isSafeInteger(d.maxTicks) && d.maxTicks > 0 && d.maxTicks <= 100000, 'EXPLICIT_TICK_BUDGET');
  need(Number.isSafeInteger(d.timeoutMs) && d.timeoutMs > 0 && d.timeoutMs <= 30000, 'EXPLICIT_WALL_BUDGET');
  let pinned, sealed = false, phase = 'before-init', lastDispatchEvent, roundIntent;
  let paidStarts = 0, ticks = 0, acceptedEnds = 0;
  const usedDeliveries = new WeakSet();
  let lastAcceptedLogicDelivery, lastAcceptedLogicSID;
  function acceptDelivery(delivery, event) {
    need(delivery && typeof delivery === 'object' && !usedDeliveries.has(delivery), 'ONE_USE_ORIGINAL_DELIVERY');
    d.assertOriginalAcceptedDelivery(delivery, event, d.readOriginalSessionID());
    usedDeliveries.add(delivery);
    if(event==='Logic'){lastAcceptedLogicDelivery=delivery;lastAcceptedLogicSID=d.readOriginalSessionID();}
    else {lastAcceptedLogicDelivery=undefined;lastAcceptedLogicSID=undefined;}
  }

  function host() {
    need(!sealed, 'SEALED'); d.assertOriginalOpen();
    const h = d.readHost(), Main = h?.context?.sgigame?.Main;
    const Model = h?.context?.sgigame?.GameStateModel;
    need(h && h.disposed !== true && typeof Main === 'function' && typeof Model === 'function', 'OWN_MAIN_TYPES');
    const main = h.outerGame?.main;
    need(main instanceof Main && main.startAutoplay === Main.prototype.startAutoplay, 'ORIGINAL_MAIN_PUBLIC_ACTION');
    const entries = main._context?.injector?.singletonMap;
    need(Array.isArray(entries), 'ORIGINAL_INJECTOR');
    const models = entries.filter(e => e.instance instanceof Model);
    need(models.length === 1 && models[0].instance.getCurrentState === Model.prototype.getCurrentState,
      'ONE_ORIGINAL_STATE_MODEL');
    const current = { h, main, Model, model: models[0].instance, Main };
    if (!pinned) pinned = current;
    need(Object.keys(current).every(k => current[k] === pinned[k]), 'PINNED_HOST_IDENTITY');
    need(Array.isArray(h.pending) && h.pending.length <= 1, 'ONE_NATIVE_PENDING');
    need(h.errors.length === 0 && typeof h.runDue === 'function', 'HEALTHY_ORIGINAL_HOST');
    return current;
  }

  function idle(x) {
    const states = x.h.context.sgigame.BaseGameStates, subgames = x.h.context.sgigame.SubGames;
    need(states && subgames, 'ORIGINAL_STATE_CONSTANTS');
    return x.model.getCurrentState()?.stateName === states.IDLE_STATE &&
      x.model.getSubGame() === subgames.BASE_GAME && x.h.pending.length === 0;
  }

  const freeIntroInput=require('./own32816-free-intro-native-input-v1.cjs').createOwn32816FreeIntroNativeInput({
    readHost:()=>host().h,
    assertOriginalOpen:()=>{need(!sealed,'FREE_INTRO_SELECTOR_OPEN');d.assertOriginalOpen();},
    assertActiveOriginalPaidIntent:intent=>need(phase==='round-active'&&roundIntent===intent&&paidStarts===acceptedEnds+1,'FREE_INTRO_CONSUMED_CURRENT_PAID_INTENT'),
    assertCurrentAcceptedLogic:delivery=>{
      need(phase==='round-active'&&roundIntent&&lastDispatchEvent==='Logic'&&delivery===lastAcceptedLogicDelivery&&usedDeliveries.has(delivery)&&lastAcceptedLogicSID===d.readOriginalSessionID(),'FREE_INTRO_CURRENT_ACCEPTED_LOGIC_SCOPE');
      d.assertOriginalAcceptedDelivery(delivery,'Logic',d.readOriginalSessionID());
    }
  });

  const paylineInput=require('./own32816-payline-native-input-v1.cjs').createOwn32816PaylineNativeInput({
    readHost:()=>host().h,
    assertOriginalOpen:()=>{need(!sealed,'PAYLINE_SELECTOR_OPEN');d.assertOriginalOpen();},
    assertActiveOriginalPaidIntent:intent=>need(phase==='round-active'&&roundIntent===intent&&paidStarts===acceptedEnds+1,'PAYLINE_CURRENT_PAID_SCOPE'),
    assertCurrentAcceptedLogic:delivery=>{
      need(phase==='round-active'&&roundIntent&&lastDispatchEvent==='Logic'&&delivery===lastAcceptedLogicDelivery&&usedDeliveries.has(delivery)&&lastAcceptedLogicSID===d.readOriginalSessionID(),'PAYLINE_CURRENT_LOGIC_SCOPE');
      d.assertOriginalAcceptedDelivery(delivery,'Logic',d.readOriginalSessionID());
    }
  });

  function stop(error) { paylineInput.seal(); freeIntroInput.seal(); sealed = true; phase = 'sealed'; throw error; }
  async function next() {
    try {
      const until = d.wallNow() + d.timeoutMs; let localTicks = 0;
      const progress={runDueCalls:0,runDueTotalMs:0,maxRunDueMs:0,yieldCalls:0,yieldTotalMs:0,maxYieldMs:0,yieldsStartingWithAudio:0,yieldWithAudioMs:0,maxYieldJobsBefore:0,maxYieldJobsAfter:0};
      let monotonicStart,cpuStart;
      try {monotonicStart=performance.now();cpuStart=process.cpuUsage();} catch {progress.observationUnavailable=true;}
      function observedRunDue(h) {
        let began;try {began=performance.now();} catch {}
        try {return h.runDue();}
        finally {try {
          const elapsed=performance.now()-began;
          if(Number.isFinite(elapsed)){progress.runDueCalls++;progress.runDueTotalMs+=elapsed;progress.maxRunDueMs=Math.max(progress.maxRunDueMs,elapsed);}
          const callback=h.own32816LastRunDueCallback;
          if(callback && Number.isFinite(callback.elapsedMs) && callback.elapsedMs>=0 &&
             (!progress.maxRunDueCallback || callback.elapsedMs>progress.maxRunDueCallback.elapsedMs)) {
            progress.maxRunDueCallback={id:callback.id,raf:callback.raf,repeat:callback.repeat,delay:callback.delay,
              sameDueCount:callback.sameDueCount,elapsedMs:callback.elapsedMs,fnName:callback.fnName};
            if(typeof callback.fnSource === 'string' && callback.fnSource.length <= 512)
              progress.maxRunDueCallback.fnSource = callback.fnSource;
            if(callback.raf && callback.framePhases)
              progress.maxRunDueCallback.framePhases = callback.framePhases;
          }
        }catch {progress.observationUnavailable=true;}}
      }
      async function observedYield(h) {
        let began,jobsBefore;try {began=performance.now();jobsBefore=h.audioPort?.jobs?.size||0;} catch {}
        try {return await d.yieldNative();}
        finally {try {const elapsed=performance.now()-began,jobsAfter=h.audioPort?.jobs?.size||0;if(Number.isFinite(elapsed)){progress.yieldCalls++;progress.yieldTotalMs+=elapsed;if(jobsBefore>0){progress.yieldsStartingWithAudio++;progress.yieldWithAudioMs+=elapsed;}if(elapsed>progress.maxYieldMs){progress.maxYieldMs=elapsed;progress.maxYieldJobsBefore=jobsBefore;progress.maxYieldJobsAfter=jobsAfter;}}}catch {progress.observationUnavailable=true;}}
      }

      while (true) {
        const x = host();
        const request = d.providerData.captureCurrentNative();
        if (request) {
          need(['Logic', 'EndGame'].includes(request.event), 'ACTUAL_NATIVE_NEXT_EVENT');
          need(x.h.pending.length === 1 && x.h.pending[0].event === request.event, 'SAME_NATIVE_PENDING');
          lastDispatchEvent = request.event;
          return request;
        }
        const wallNow=d.wallNow();
        if(!(wallNow < until && localTicks < d.maxTicks)) {
          // Same finite guard; details are retained only by the existing private
          // cause record. The public stop summary keeps the symbolic reason only.
          const detail={stage:'next',elapsedMs:wallNow-(until-d.timeoutMs),timeoutMs:d.timeoutMs,
            localTicks,maxTicks:d.maxTicks,wallBudgetExceeded:!(wallNow<until),tickBudgetExceeded:!(localTicks<d.maxTicks)};
          try {
            const state=x.model.getCurrentState(),subgame=x.model.getSubGame();
            try {progress.stageMonotonicElapsedMs=performance.now()-monotonicStart;if(cpuStart){const cpu=process.cpuUsage(cpuStart);progress.processUserCpuUs=cpu.user;progress.processSystemCpuUs=cpu.system;}detail.nativeProgressTimings=progress;}catch {detail.nativeProgressTimingsUnavailable=true;}

            if(typeof state?.stateName==='string')detail.state=state.stateName;
            if(typeof subgame==='string')detail.subgame=subgame;
            if(Number.isSafeInteger(x.h.timers?.size))detail.timerCount=x.h.timers.size;
            if(Number.isSafeInteger(x.h.audioPort?.jobs?.size))detail.audioJobCount=x.h.audioPort.jobs.size;
            detail.pendingEvents=x.h.pending.map(p=>p.event);
          } catch {detail.snapshotUnavailable=true;}
          need(false,'FINITE_NEXT_BUDGET '+JSON.stringify(detail));
        }
        if(lastAcceptedLogicDelivery) {
          const payline=paylineInput.tryMouseDown({paidIntent:roundIntent,delivery:lastAcceptedLogicDelivery});
          if(payline.status==='dispatched'){localTicks++;ticks++;await observedYield(x.h);continue;}
          const input=freeIntroInput.tryMouseDown({paidIntent:roundIntent,delivery:lastAcceptedLogicDelivery});
          if(input.status==='dispatched') {localTicks++;ticks++;await observedYield(x.h);continue;}
          if(input.status==='wait') {
            observedRunDue(x.h);localTicks++;ticks++;await observedYield(x.h);continue;
          }
        }
        need(observedRunDue(x.h), 'NO_MAPPED_NATIVE_CONTINUATION');
        localTicks++; ticks++;
        await observedYield(x.h);
      }
    } catch (error) { return stop(error); }
  }

  return Object.freeze({
    acceptInit(delivery) {
      try {
        need(phase === 'before-init', 'ONE_INIT');
        acceptDelivery(delivery, 'Init');
        need(idle(host()), 'INIT_ACK_NATIVE_IDLE'); phase = 'ready';
      } catch (error) { stop(error); }
    },
    async paid(intent) {
      try {
        const x = host();
        need((phase === 'ready' || phase === 'ended') && idle(x), 'CLOSED_ORIGINAL_IDLE_BEFORE_PAID');
        d.consumeOriginalPaidIntent(intent, d.readOriginalSessionID());
        roundIntent = intent; phase = 'round-active'; paidStarts++;
        // Existing original Main API emits its own GLSServer request. Neither
        // the request XML, native state nor autoplay callback is manufactured.
        x.main.startAutoplay(1);
        const request = await next(); need(request.event === 'Logic', 'ACTUAL_FIRST_LOGIC');
        return request;
      } catch (error) { return stop(error); }
    },
    async afterAccepted(delivery) {
      try {
        need(phase === 'round-active' && roundIntent, 'ACTIVE_ORIGINAL_PAID_SCOPE');
        need(['Logic', 'EndGame'].includes(lastDispatchEvent), 'EXACT_PRIOR_NATIVE_EVENT');
        acceptDelivery(delivery, lastDispatchEvent);
        if (lastDispatchEvent === 'EndGame') {
          const until=d.wallNow()+d.timeoutMs;let localTicks=0;
          while(!idle(host())) {
            const x=host();
            need(x.h.pending.length===0 && !d.providerData.captureCurrentNative(), 'NO_NEXT_REQUEST_BEFORE_END_IDLE');
            need(d.wallNow()<until && localTicks<d.maxTicks, 'FINITE_END_IDLE_BUDGET');
            need(x.h.runDue(), 'ORIGINAL_END_ACK_PROGRESS');
            localTicks++;ticks++;await d.yieldNative();
          }
          need(idle(host()), 'ACTUAL_END_ACK_NATIVE_IDLE');
          phase = 'ended'; acceptedEnds++; roundIntent = undefined;
          return Object.freeze({ terminal: true, nextAction: 'SPIN', actualEndACK: true });
        }
        const request = await next();
        return Object.freeze({ terminal: false, request,
          nextAction: request.event === 'EndGame' ? 'PLAY' : 'FREE_SPIN', actualEndACK: false });
      } catch (error) { return stop(error); }
    },
    seal() { paylineInput.seal(); freeIntroInput.seal(); sealed = true; phase = 'sealed'; },
    status() { return { gameId: '32816', phase, sealed, paidStarts, acceptedEnds, ticks,
      physicalTransportIncluded: false, terminalSynthesized: false, freeIntroInput: freeIntroInput.status(), paylineInput:paylineInput.status(), productionReady: false }; }
  });
};
