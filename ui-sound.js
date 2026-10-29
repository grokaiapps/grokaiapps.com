/* GROKAIAPPS interface sounds — synthesized with Web Audio, no files.
   Wood, glass and water-drop textures; 30–200 ms each; quiet by default.
   Nothing plays until the visitor's first tap or click. */
(function () {
  "use strict";

  var KEY = "grokaiapps-sound";
  var ac = null, out = null, room = null, noiseBuf = null;
  var unlocked = false;
  var lastAt = {}, lastAny = 0;
  var GAP = { hover: 70, tick: 45, tab: 60, select: 60, back: 60, open: 120, close: 120, copy: 120, error: 160, toggle: 80 };
  var listeners = [];
  var silencer = null; // returns true when sounds should hold back (e.g. the intro is playing)

  function reduced() {
    return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }
  function stored() {
    try { return localStorage.getItem(KEY); } catch (e) { return null; }
  }
  var enabled = (function () {
    var v = stored();
    if (v === "on") return true;
    if (v === "off") return false;
    return !reduced();
  })();

  function ctx() {
    if (ac) return ac;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try { ac = new AC({ latencyHint: "interactive" }); } catch (e) { try { ac = new AC(); } catch (e2) { return null; } }
    out = ac.createGain();
    out.gain.value = 0.55;
    var comp = ac.createDynamicsCompressor();
    comp.threshold.value = -24; comp.knee.value = 12; comp.ratio.value = 4; comp.attack.value = 0.002; comp.release.value = 0.12;
    out.connect(comp);
    comp.connect(ac.destination);
    // a small, soft room so the clicks sit in a space rather than in your ear
    room = ac.createConvolver();
    var len = Math.floor(ac.sampleRate * 0.45), buf = ac.createBuffer(2, len, ac.sampleRate);
    for (var ch = 0; ch < 2; ch++) {
      var d = buf.getChannelData(ch);
      for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2) * 0.6;
    }
    room.buffer = buf;
    var wet = ac.createGain();
    wet.gain.value = 0.22;
    room.connect(wet);
    wet.connect(out);
    // shared noise
    var nlen = Math.floor(ac.sampleRate * 0.6);
    noiseBuf = ac.createBuffer(1, nlen, ac.sampleRate);
    var nd = noiseBuf.getChannelData(0);
    for (var j = 0; j < nlen; j++) nd[j] = Math.random() * 2 - 1;
    return ac;
  }

  function unlock() {
    if (unlocked) return;
    var c = ctx();
    if (!c) return;
    unlocked = true;
    try {
      if (c.state === "suspended") c.resume();
      var b = c.createBuffer(1, 1, c.sampleRate), s = c.createBufferSource();
      s.buffer = b; s.connect(c.destination); s.start(0);
    } catch (e) {}
  }
  ["pointerdown", "touchend", "keydown", "click"].forEach(function (ev) {
    window.addEventListener(ev, unlock, { capture: true, passive: true });
  });

  /* ---------- building blocks ---------- */
  function env(t0, peak, attack, decay) {
    var g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + decay);
    return g;
  }
  function send(node, wet) {
    node.connect(out);
    if (wet) {
      var w = ac.createGain();
      w.gain.value = wet;
      node.connect(w);
      w.connect(room);
    }
  }
  // a sine "drop": pitch glides from f0 to f1
  function drop(t0, f0, f1, dur, peak, wet, type) {
    var o = ac.createOscillator();
    o.type = type || "sine";
    o.frequency.setValueAtTime(f0, t0);
    o.frequency.exponentialRampToValueAtTime(f1, t0 + dur * 0.7);
    var g = env(t0, peak, 0.004, dur);
    o.connect(g);
    send(g, wet);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }
  // a glassy partial stack
  function glass(t0, f, dur, peak, wet) {
    [[1, 1], [2.76, 0.28], [5.4, 0.08]].forEach(function (h) {
      var o = ac.createOscillator();
      o.type = "sine";
      o.frequency.value = f * h[0];
      var g = env(t0, peak * h[1], 0.003, dur * (h[0] === 1 ? 1 : 0.55));
      o.connect(g);
      send(g, wet);
      o.start(t0);
      o.stop(t0 + dur + 0.05);
    });
  }
  // filtered noise: wood knocks and paper whooshes
  function noise(t0, dur, peak, type, f0, f1, q, wet) {
    var s = ac.createBufferSource();
    s.buffer = noiseBuf;
    var f = ac.createBiquadFilter();
    f.type = type;
    f.Q.value = q || 1;
    f.frequency.setValueAtTime(f0, t0);
    if (f1 && f1 !== f0) f.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
    var g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + Math.min(0.05, dur * 0.35));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    s.connect(f);
    f.connect(g);
    send(g, wet);
    s.start(t0, Math.random() * 0.3);
    s.stop(t0 + dur + 0.05);
  }

  var SOUNDS = {
    // desktop only: the faintest glass tick as focus moves
    hover: function (t) { glass(t, 2350, 0.05, 0.014, 0); },
    // wooden tick for small toggles
    tick: function (t) {
      drop(t, 1500, 900, 0.035, 0.05, 0.1, "triangle");
      noise(t, 0.018, 0.03, "bandpass", 3200, 3200, 2.5, 0);
    },
    // tab or section change: two soft wooden taps, like a well-made switch
    tab: function (t) {
      drop(t, 1250, 760, 0.045, 0.06, 0.15, "triangle");
      noise(t, 0.02, 0.025, "bandpass", 2600, 2600, 3, 0);
      drop(t + 0.035, 1900, 1400, 0.04, 0.025, 0.2, "sine");
    },
    // select / open: a water drop
    select: function (t) {
      drop(t, 520, 1350, 0.09, 0.07, 0.35);
      glass(t + 0.012, 1760, 0.12, 0.012, 0.3);
    },
    // close / back: the drop in reverse, softer
    back: function (t) {
      drop(t, 1150, 520, 0.08, 0.05, 0.25);
    },
    // pop-up opens: a paper whoosh that matches the blur, landing on a drop
    open: function (t) {
      noise(t, 0.2, 0.035, "bandpass", 420, 2100, 0.9, 0.3);
      drop(t + 0.13, 600, 1400, 0.09, 0.05, 0.4);
    },
    // pop-up closes: the whoosh falling away
    close: function (t) {
      noise(t, 0.16, 0.03, "bandpass", 1900, 380, 0.9, 0.25);
      drop(t + 0.05, 980, 480, 0.08, 0.03, 0.3);
    },
    // copy confirmed: two glass notes
    copy: function (t) {
      glass(t, 1568, 0.22, 0.035, 0.35);
      glass(t + 0.075, 2093, 0.28, 0.03, 0.4);
    },
    // unavailable: two muted wooden thuds, low
    error: function (t) {
      drop(t, 260, 180, 0.07, 0.07, 0.1, "triangle");
      drop(t + 0.1, 220, 150, 0.08, 0.06, 0.1, "triangle");
    },
    // sound switched on
    toggle: function (t) {
      glass(t, 1318, 0.14, 0.03, 0.3);
      glass(t + 0.06, 1976, 0.18, 0.025, 0.35);
    }
  };

  function play(name, opts) {
    if (!enabled || !unlocked || !SOUNDS[name]) return;
    if (silencer && silencer() && !(opts && opts.force)) return;
    var now = performance.now();
    if (now - (lastAt[name] || 0) < (GAP[name] || 60)) return;
    if (name === "hover" && now - lastAny < 90) return;
    if (name !== "hover" && now - lastAny < 30) return;
    lastAt[name] = now;
    lastAny = now;
    var c = ctx();
    if (!c) return;
    if (c.state === "suspended") { try { c.resume(); } catch (e) {} }
    try { SOUNDS[name](c.currentTime + 0.005); } catch (e) {}
  }

  function set(on, save) {
    enabled = !!on;
    if (save !== false) { try { localStorage.setItem(KEY, enabled ? "on" : "off"); } catch (e) {} }
    listeners.forEach(function (fn) { try { fn(enabled); } catch (e) {} });
    if (enabled) { unlock(); play("toggle", { force: true }); }
  }

  window.UISound = {
    play: play,
    get enabled() { return enabled; },
    set: set,
    toggle: function () { set(!enabled); return enabled; },
    onChange: function (fn) { listeners.push(fn); },
    holdWhile: function (fn) { silencer = fn; }
  };
})();
