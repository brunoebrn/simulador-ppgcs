/* Relógio único de animação. Velocidade, pausa, quadro a quadro e reinício valem para TODAS as animações e simulações.
 * Uma "tarefa" implementa: advance(dt) com dt em segundos de tempo de animação já multiplicados pela velocidade,
 * e step() (um quadro). Tarefa com done=true é removida. */
(function () {
  "use strict";
  var NS = (window.PPGCS = window.PPGCS || {});
  var reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var tasks = [], last = null, raf = 0, listeners = [];
  var clock = {
    speed: 1, paused: false, reduced: reduced,
    speeds: [0.25, 0.5, 1, 2, 4, 8],
    add: function (t) { tasks.push(t); if (reduced && t.instantOnReduced) { t.finish && t.finish(); t.done = true; } kick(); return t; },
    clear: function () { tasks.length = 0; },
    active: function () { return tasks.length > 0; },
    onChange: function (fn) { listeners.push(fn); },
    setSpeed: function (s) { clock.speed = s; emit(); },
    pause: function () { clock.paused = true; emit(); },
    play: function () { clock.paused = false; last = null; emit(); kick(); },
    toggle: function () { clock.paused ? clock.play() : clock.pause(); },
    stepFrame: function () { tasks.slice().forEach(function (t) { if (!t.done && t.step) t.step(); }); sweep(); },
    restart: function () { listeners.forEach(function (fn) { fn("restart"); }); }
  };
  function emit() { listeners.forEach(function (fn) { fn("state"); }); }
  function sweep() { tasks = tasks.filter(function (t) { return !t.done; }); }
  function frame(ts) {
    raf = 0;
    if (last == null) last = ts;
    var dt = Math.min(0.1, (ts - last) / 1000); last = ts;
    if (!clock.paused && !reduced) {
      var d = dt * clock.speed;
      tasks.slice().forEach(function (t) { if (!t.done) t.advance(d); });
      sweep();
    }
    if (tasks.length && !clock.paused) raf = requestAnimationFrame(frame); else last = null;
  }
  function kick() { if (!raf && tasks.length && !clock.paused) raf = requestAnimationFrame(frame); }

  /* Tween: anima p de 0 a 1 em `dur` segundos (a 1x). */
  clock.tween = function (dur, onUpdate, onDone) {
    var t = { p: 0, done: false, instantOnReduced: true,
      advance: function (d) { t.p = Math.min(1, t.p + d / dur); onUpdate(t.p); if (t.p >= 1) { t.done = true; onDone && onDone(); } },
      step: function () { t.advance(1 / 20 * 1); },
      finish: function () { t.p = 1; onUpdate(1); onDone && onDone(); } };
    onUpdate(0);
    return clock.add(t);
  };
  /* Simulação por taxa: chama `fn()` (uma réplica) `rate` vezes por segundo a 1x. */
  clock.rateTask = function (rate, fn, isDone) {
    var acc = 0, t = { done: false,
      advance: function (d) { acc += d * rate; var n = Math.min(400, Math.floor(acc)); acc -= n; for (var i = 0; i < n && !t.done; i++) { fn(); if (isDone()) { t.done = true; } } },
      step: function () { fn(); if (isDone()) t.done = true; } };
    return clock.add(t);
  };
  NS.clock = clock;
})();
