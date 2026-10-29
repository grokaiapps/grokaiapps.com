/* GROKAIAPPS intro film — drawn live in code, no video file.
   29 seconds: Pond → Title → Meaning → Open Exhibits → black.
   Picture: <canvas>. Sound: the original narration + music mix, embedded by intro-audio.js
   (no separate media request) and used as the clock; the generated Web Audio music is only
   a fallback for browsers that can't play the embedded track.
   Mounts on any element with [data-intro-film] and makes it behave like a <video>
   (play(), pause(), paused, currentTime, and play/pause/timeupdate events). */
(function () {
  "use strict";

  var WN = window.WHATS_NEW && window.WHATS_NEW.audio && window.WHATS_NEW.duration ? window.WHATS_NEW : null;
  var DUR = WN ? WN.duration : 29;
  var TAU = Math.PI * 2;
  var CUES = [
    { s: 0.55, e: 5.471, t: "Software can go do the job now. The hard part is understanding it while it does." },
    { s: 6.671, e: 14.948, t: "I’m Grok. AI. Apps. I make small tools with AI, and I put them here so you can actually try them." },
    { s: 16.148, e: 23.265, t: "Grok means understand so thoroughly it changes how you move. Leave with a next step, not a pile of tabs." },
    { s: 24.465, e: 27.903, t: "Open Exhibits and try one. That’s the next step." }
  ];
  // Scene boundaries (crossfade is 1s centred on each).
  var BOUNDS = [0, 5.95, 15.5, 23.9];
  var END_BLACK = 27.95;
  var POSTER_T = 10.2;
  var END_T = 27.2;
  if (WN) {
    CUES.push({ s: WN.start, e: WN.end, t: WN.caption });
    BOUNDS.push(WN.start - 0.55);
    END_BLACK = DUR - 1.0;
    END_T = WN.end - 0.2;
  }

  /* ---------- small helpers ---------- */
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function sm(x) { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); }
  function easeOut(x) { x = clamp(x, 0, 1); return 1 - Math.pow(1 - x, 3); }
  function easeOutExpo(x) { x = clamp(x, 0, 1); return x >= 1 ? 1 : 1 - Math.pow(2, -10 * x); }
  function easeInOut(x) { x = clamp(x, 0, 1); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; }
  function rgba(c, a) { return "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + clamp(a, 0, 1).toFixed(3) + ")"; }
  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  // a wobbly edge: sum of a few sines around the circle
  function edge(r, amp, maxF) {
    var parts = [];
    for (var k = 2; k <= maxF; k++) parts.push([k, (r() * 2 - 1) * amp / Math.sqrt(k - 1), r() * TAU]);
    return function (th) {
      var v = 0;
      for (var i = 0; i < parts.length; i++) v += parts[i][1] * Math.sin(parts[i][0] * th + parts[i][2]);
      return v;
    };
  }
  function fmt(t) {
    t = Math.max(0, Math.floor(t + 0.0001));
    return Math.floor(t / 60) + ":" + ("0" + (t % 60)).slice(-2);
  }

  /* ---------- palette (follows the site theme) ---------- */
  function palette() {
    var dark = document.documentElement.getAttribute("data-theme") === "dark";
    return dark ? {
      dark: true,
      paper: [22, 22, 21], ink: [200, 198, 192], gold: [201, 170, 118], seal: [176, 66, 58], silver: [150, 150, 146],
      grain: 9, vignette: 0.42
    } : {
      dark: false,
      paper: [240, 239, 235], ink: [20, 20, 20], gold: [150, 117, 68], seal: [142, 43, 37], silver: [160, 160, 155],
      grain: 7, vignette: 0.1
    };
  }

  function makePaper(w, h, P) {
    var c = document.createElement("canvas");
    c.width = w; c.height = h;
    var g = c.getContext("2d");
    g.fillStyle = rgba(P.paper, 1);
    g.fillRect(0, 0, w, h);
    // soft mottling
    var m = document.createElement("canvas");
    m.width = 48; m.height = 27;
    var mg = m.getContext("2d"), r = rng(11);
    for (var y = 0; y < 27; y++) for (var x = 0; x < 48; x++) {
      var v = r();
      mg.fillStyle = rgba(P.dark ? [255, 255, 255] : [0, 0, 0], v * 0.05);
      mg.fillRect(x, y, 1, 1);
    }
    g.imageSmoothingEnabled = true;
    g.drawImage(m, 0, 0, w, h);
    // fibres
    var s = h / 720;
    g.lineCap = "round";
    for (var i = 0; i < 260; i++) {
      var fx = r() * w, fy = r() * h, len = (8 + r() * 30) * s, ang = r() * TAU;
      g.strokeStyle = rgba(P.dark ? [255, 255, 255] : [60, 55, 45], 0.02 + r() * 0.03);
      g.lineWidth = Math.max(0.5, 0.6 * s);
      g.beginPath();
      g.moveTo(fx, fy);
      g.quadraticCurveTo(fx + Math.cos(ang + 0.6) * len * 0.5, fy + Math.sin(ang + 0.6) * len * 0.5, fx + Math.cos(ang) * len, fy + Math.sin(ang) * len);
      g.stroke();
    }
    // grain
    var img = g.getImageData(0, 0, w, h), d = img.data, amp = P.grain;
    for (var p = 0; p < d.length; p += 4) {
      var n = (Math.random() - 0.5) * amp;
      d[p] += n; d[p + 1] += n; d[p + 2] += n;
    }
    g.putImageData(img, 0, 0);
    // vignette
    var vg = g.createRadialGradient(w / 2, h / 2, h * 0.35, w / 2, h / 2, Math.hypot(w, h) * 0.62);
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, "rgba(0,0,0," + P.vignette + ")");
    g.fillStyle = vg;
    g.fillRect(0, 0, w, h);
    return c;
  }

  /* ---------- drawing primitives ---------- */
  function blot(g, x, y, r, a, wob, rgb, rim) {
    if (r <= 0.5 || a <= 0.002) return;
    var N = 44;
    g.beginPath();
    for (var i = 0; i <= N; i++) {
      var th = i / N * TAU, rr = r * (1 + wob(th));
      var px = x + Math.cos(th) * rr, py = y + Math.sin(th) * rr;
      if (i) g.lineTo(px, py); else g.moveTo(px, py);
    }
    var gr = g.createRadialGradient(x, y, 0, x, y, r * 1.2);
    gr.addColorStop(0, rgba(rgb, a * 0.42));
    gr.addColorStop(0.62, rgba(rgb, a * 0.6));
    gr.addColorStop(0.86, rgba(rgb, a * (rim || 1)));
    gr.addColorStop(1, rgba(rgb, a * 0.25));
    g.fillStyle = gr;
    g.fill();
  }

  // A brushed ensō built from many bristles. p = how much of the stroke is drawn (0..1).
  var bristleSets = {};
  function enso(g, cx, cy, R, w, p, rgb, alpha, seed) {
    if (p <= 0) return;
    var key = seed;
    if (!bristleSets[key]) {
      var r = rng(seed), list = [];
      for (var b = 0; b < 30; b++) list.push({ o: r() * 2 - 1, a: 0.35 + r() * 0.55, lw: 0.6 + r() * 1.1, dry: r(), ph: r() * TAU, fr: 18 + r() * 40 });
      bristleSets[key] = { list: list, wob: edge(rng(seed + 1), 0.016, 6) };
    }
    var set = bristleSets[key], B = set.list.length;
    var STEPS = 200, start = -1.85, sweep = 5.62;
    var n = Math.floor(STEPS * clamp(p, 0, 1));
    g.lineCap = "round";
    g.lineJoin = "round";
    for (var bi = 0; bi < B; bi++) {
      var br = set.list[bi];
      g.beginPath();
      var pen = false;
      for (var k = 0; k <= n; k++) {
        var f = k / STEPS, th = start + sweep * f;
        var prof = Math.min(1, f / 0.05) * (1 - Math.pow(f, 2.4) * 0.6);
        var width = w * (0.5 + 0.5 * prof);
        var rr = R * (1 + set.wob(th)) + br.o * width * 0.5;
        var dryStart = 0.5 + br.dry * 0.42;
        var vis = f < dryStart || Math.sin(f * br.fr + br.ph) > (f - dryStart) * 5.5 - 0.15;
        var x = cx + Math.cos(th) * rr, y = cy + Math.sin(th) * rr;
        if (vis) { if (pen) g.lineTo(x, y); else g.moveTo(x, y); pen = true; } else pen = false;
      }
      g.strokeStyle = rgba(rgb, alpha * br.a);
      g.lineWidth = Math.max(0.6, (w / B) * 2.3 * br.lw);
      g.stroke();
    }
    // the press of the brush where it lands
    var th0 = start, lx = cx + Math.cos(th0) * R, ly = cy + Math.sin(th0) * R;
    g.fillStyle = rgba(rgb, alpha * 0.55 * clamp(p * 8, 0, 1));
    g.beginPath();
    g.ellipse(lx, ly, w * 0.5, w * 0.42, th0 + Math.PI / 2, 0, TAU);
    g.fill();
  }

  function spaced(g, text, x, y, track) {
    // draw letter-spaced text centred on x
    var widths = [], total = 0;
    for (var i = 0; i < text.length; i++) { var cw = g.measureText(text[i]).width; widths.push(cw); total += cw; }
    total += track * (text.length - 1);
    var cx = x - total / 2;
    g.textAlign = "left";
    for (var j = 0; j < text.length; j++) { g.fillText(text[j], cx, y); cx += widths[j] + track; }
    return total;
  }

  // Washes are painted small and scaled up, which blurs them the way wet ink bleeds.
  var washC = null;
  function wash(W, H) {
    var w = Math.max(64, Math.round(W / 6)), h = Math.max(36, Math.round(H / 6));
    if (!washC || washC.width !== w || washC.height !== h) {
      washC = document.createElement("canvas");
      washC.width = w; washC.height = h;
    }
    var c = washC.getContext("2d");
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, w, h);
    c.setTransform(w / W, 0, 0, h / H, 0, 0);
    return c;
  }
  function blotShape(g, x, y, r, wob, sx, rot, n) {
    var N = n || 44;
    g.beginPath();
    for (var i = 0; i <= N; i++) {
      var th = i / N * TAU, rr = r * (1 + wob(th));
      var px = Math.cos(th) * rr * sx, py = Math.sin(th) * rr;
      var cr = Math.cos(rot), sr = Math.sin(rot);
      var X = x + px * cr - py * sr, Y = y + px * sr + py * cr;
      if (i) g.lineTo(X, Y); else g.moveTo(X, Y);
    }
  }

  /* ---------- the four scenes ---------- */
  var SEED = rng(2026);
  var S1 = (function () {
    var r = rng(7), blots = [], flecks = [];
    function add(cx, cy, sx, sy, n, rmin, rmax, b0, b1, a0, a1) {
      for (var i = 0; i < n; i++) {
        var ang = r() * TAU, d = Math.pow(r(), 0.7);
        blots.push({
          x: cx + Math.cos(ang) * sx * d, y: cy + Math.sin(ang) * sy * d,
          r: rmin + r() * (rmax - rmin), b: b0 + r() * (b1 - b0), a: a0 + r() * (a1 - a0),
          vx: (r() - 0.5) * 0.012, vy: (r() - 0.5) * 0.008, w: edge(rng(100 + blots.length), 0.2, 8), rim: 1.05 + r() * 0.35,
          sx: 0.7 + r() * 0.8, rot: r() * TAU, tide: r() < 0.14
        });
      }
    }
    add(0.62, 0.62, 0.26, 0.22, 24, 0.07, 0.24, 0.0, 3.0, 0.05, 0.13);
    add(0.86, 0.26, 0.12, 0.12, 9, 0.05, 0.15, 0.8, 3.6, 0.04, 0.1);
    add(0.32, 0.86, 0.18, 0.1, 10, 0.05, 0.14, 1.2, 4.0, 0.04, 0.1);
    add(0.62, 0.62, 0.45, 0.35, 16, 0.02, 0.06, 1.6, 4.6, 0.06, 0.14);
    for (var i = 0; i < 22; i++) flecks.push({ x: 0.35 + r() * 0.6, y: 0.35 + r() * 0.6, s: 0.6 + r() * 1.3, ph: r() * TAU, v: 0.004 + r() * 0.01 });
    return function (g, t, W, H, s, P) {
      var z = 1 + 0.03 * clamp(t / 6, 0, 1);
      var wg = wash(W, H);
      wg.save();
      wg.translate(W / 2, H / 2); wg.scale(z, z); wg.translate(-W / 2, -H / 2);
      var live = [];
      for (var i = 0; i < blots.length; i++) {
        var b = blots[i], age = t - b.b;
        if (age <= 0) continue;
        var rr = b.r * H * easeOut(age / 2.8) * (1 + 0.035 * age);
        var bx = (b.x + b.vx * age) * W, by = (b.y + b.vy * age) * H, ba = b.a * 1.25 * (0.6 + 0.4 * easeOut(age / 1.5));
        wg.save();
        wg.translate(bx, by); wg.rotate(b.rot); wg.scale(b.sx, 1);
        blot(wg, 0, 0, rr, ba, b.w, P.ink, b.rim);
        wg.restore();
        if (b.tide) live.push([bx, by, rr, ba, b]);
      }
      wg.restore();
      g.imageSmoothingEnabled = true;
      g.drawImage(washC, 0, 0, W, H);
      // tide lines: the darker edge pigment leaves as it dries
      g.save();
      g.translate(W / 2, H / 2); g.scale(z, z); g.translate(-W / 2, -H / 2);
      g.lineWidth = Math.max(0.6, 0.9 * s);
      for (var q = 0; q < live.length; q++) {
        var L = live[q];
        blotShape(g, L[0], L[1], L[2] * 0.98, L[4].w, L[4].sx, L[4].rot);
        g.strokeStyle = rgba(P.ink, L[3] * 0.35);
        g.stroke();
      }
      g.restore();
      // ripple ensō upper left
      var ex = 0.22 * W, ey = 0.3 * H, eR = 0.095 * H;
      enso(g, ex, ey, eR, 0.016 * H, easeInOut((t - 0.3) / 2.2), P.ink, 0.55, 31);
      for (var j = 0; j < 5; j++) {
        var ph = t - 0.9 - j * 1.05;
        if (ph <= 0) continue;
        g.strokeStyle = rgba(P.ink, 0.22 * Math.exp(-ph / 2.0));
        g.lineWidth = Math.max(0.6, 1.1 * s);
        g.beginPath();
        g.ellipse(ex, ey, eR + ph * 0.06 * H, (eR + ph * 0.06 * H) * 0.96, 0, 0, TAU);
        g.stroke();
      }
      // a few flecks of gold suspended in the wash
      for (var k = 0; k < flecks.length; k++) {
        var f = flecks[k], tw = 0.45 + 0.35 * Math.sin(t * 1.4 + f.ph);
        g.fillStyle = rgba(P.gold, tw * sm((t - 1.2) / 1.5));
        g.beginPath();
        g.arc(f.x * W, (f.y - f.v * t) * H, f.s * s, 0, TAU);
        g.fill();
      }
    };
  })();

  var S2 = function (g, t, W, H, s, P, F) {
    var lt = t - BOUNDS[1];
    var z = 1.025 - 0.025 * easeOut(lt / 6);
    var cx = 0.5 * W, cy = 0.375 * H, R = 0.19 * H, w = 0.05 * H;
    g.save();
    g.translate(cx, cy); g.scale(z, z); g.translate(-cx, -cy);
    var p = easeInOut((t - 6.25) / 1.75);
    enso(g, cx, cy, R, w, p, P.ink, 0.92, 53);
    // gold hairline just inside the stroke
    var gp = easeOut((t - 7.7) / 1.6);
    if (gp > 0) {
      g.strokeStyle = rgba(P.gold, 0.75 * gp);
      g.lineWidth = Math.max(0.7, 1.2 * s);
      g.beginPath();
      g.arc(cx, cy, R - w * 0.75, -1.85, -1.85 + 5.4 * gp);
      g.stroke();
    }
    // seal
    var sp = clamp((t - 9.5) / 0.45, 0, 1);
    if (sp > 0) {
      var ss = 0.036 * H, sc = 1 + 0.25 * (1 - easeOut(sp));
      var sx = cx + R * 1.3, sy = cy + R * 0.92;
      g.save();
      g.translate(sx, sy); g.scale(sc, sc); g.rotate(-0.04);
      g.fillStyle = rgba(P.seal, 0.9 * sp);
      g.fillRect(-ss / 2, -ss / 2, ss, ss);
      g.strokeStyle = rgba(P.paper, 0.75 * sp);
      g.lineWidth = Math.max(0.8, ss * 0.07);
      g.strokeRect(-ss * 0.3, -ss * 0.3, ss * 0.6, ss * 0.6);
      g.beginPath(); g.moveTo(-ss * 0.3, 0); g.lineTo(ss * 0.3, 0); g.stroke();
      g.restore();
    }
    g.restore();
    // wordmark
    var wa = easeOut((t - 8.3) / 1.3);
    if (wa > 0) {
      g.fillStyle = rgba(P.ink, 0.92 * wa);
      g.font = "300 " + Math.round(0.052 * H) + "px " + F.display;
      g.textBaseline = "alphabetic";
      spaced(g, "GROKAIAPPS", W / 2, 0.735 * H + (1 - wa) * 10 * s, 0.022 * H);
    }
  };

  var S3 = (function () {
    var r = rng(19), drops = [], spatter = [];
    for (var i = 0; i < 52; i++) {
      var ang = r() * TAU, d = 1.12 + Math.pow(r(), 1.8) * 1.7;
      drops.push({ ang: ang, d: d, sz: (0.025 + Math.pow(r(), 3) * 0.1) / Math.sqrt(d), st: 1 + r() * 1.8, a: 0.55 + r() * 0.35 });
    }
    for (var j = 0; j < 160; j++) {
      var a2 = r() * TAU, d2 = 0.6 + Math.pow(r(), 0.8) * 3.2;
      spatter.push({ ang: a2, d: d2, sz: 0.4 + r() * 1.8, a: 0.25 + r() * 0.5, gold: r() < 0.08 });
    }
    var core = edge(rng(23), 0.16, 17), halo = edge(rng(29), 0.14, 6), inner = edge(rng(31), 0.1, 9);
    return function (g, t, W, H, s, P, F) {
      // pale wash, paper on the left drifting to a silver tone on the right
      var lg = g.createLinearGradient(0, 0, W, 0);
      lg.addColorStop(0, rgba(P.silver, 0));
      lg.addColorStop(1, rgba(P.silver, P.dark ? 0.1 : 0.16));
      g.fillStyle = lg;
      g.fillRect(0, 0, W, H);
      // ripples lower left
      var rx = 0.13 * W, ry = 0.84 * H;
      for (var k = 0; k < 6; k++) {
        var rr = (0.04 + k * 0.045 + ((t - 15.5) * 0.012)) * H;
        g.strokeStyle = rgba(P.ink, 0.16 * (1 - k / 6));
        g.lineWidth = Math.max(0.6, 1 * s);
        g.beginPath(); g.ellipse(rx, ry, rr * 1.35, rr * 0.55, 0, 0, TAU); g.stroke();
      }
      // splash
      var q = easeOutExpo((t - 16.05) / 0.75);
      var sx = 0.77 * W, sy = 0.47 * H, Rs = 0.15 * H * (1 + 0.012 * Math.max(0, t - 16.05));
      if (q > 0) {
        var wg = wash(W, H);
        blot(wg, sx, sy, Rs * 1.6 * q, 0.15, halo, P.ink, 0.62);
        blot(wg, sx - Rs * 0.2, sy + Rs * 0.15, Rs * 2.3 * q, 0.07, inner, P.ink, 1);
        g.drawImage(washC, 0, 0, W, H);
        blotShape(g, sx, sy, Rs * q, core, 1, 0, 160);
        var cg = g.createRadialGradient(sx - Rs * 0.2, sy - Rs * 0.25, 0, sx, sy, Rs * 1.2);
        cg.addColorStop(0, rgba(P.ink, 0.97));
        cg.addColorStop(0.7, rgba(P.ink, 0.9));
        cg.addColorStop(1, rgba(P.ink, 0.8));
        g.fillStyle = cg;
        g.fill();
        for (var i = 0; i < drops.length; i++) {
          var dr = drops[i];
          var vis = clamp((q * 2.6 - dr.d) / 0.4, 0, 1);
          if (vis <= 0) continue;
          var dx = sx + Math.cos(dr.ang) * dr.d * Rs, dy = sy + Math.sin(dr.ang) * dr.d * Rs;
          g.fillStyle = rgba(P.ink, dr.a * vis);
          g.beginPath();
          g.ellipse(dx, dy, dr.sz * Rs * dr.st, dr.sz * Rs, dr.ang, 0, TAU);
          g.fill();
        }
        for (var j = 0; j < spatter.length; j++) {
          var sp = spatter[j];
          var v2 = clamp((q * 4 - sp.d) / 0.5, 0, 1);
          if (v2 <= 0) continue;
          g.fillStyle = rgba(sp.gold ? P.gold : P.ink, sp.a * v2);
          g.beginPath();
          g.arc(sx + Math.cos(sp.ang) * sp.d * Rs, sy + Math.sin(sp.ang) * sp.d * Rs * 0.8, sp.sz * s, 0, TAU);
          g.fill();
        }
      }
      // words
      var fs = Math.round(0.066 * H);
      g.font = "300 " + fs + "px " + F.display;
      g.textAlign = "left";
      g.textBaseline = "alphabetic";
      var a1 = easeOut((t - 16.5) / 1.0), a2 = easeOut((t - 17.15) / 1.0);
      g.fillStyle = rgba(P.ink, 0.95 * a1);
      g.fillText("Understand so thoroughly", 0.075 * W, 0.45 * H + (1 - a1) * 8 * s);
      g.fillStyle = rgba(P.ink, 0.95 * a2);
      g.fillText("it changes how you move.", 0.075 * W, 0.45 * H + fs * 1.18 + (1 - a2) * 8 * s);
      var ru = easeOut((t - 18.1) / 1.4);
      if (ru > 0) {
        g.strokeStyle = rgba(P.gold, 0.8);
        g.lineWidth = Math.max(0.7, 1.1 * s);
        g.beginPath();
        g.moveTo(0.077 * W, 0.45 * H + fs * 1.85);
        g.lineTo(0.077 * W + 0.1 * W * ru, 0.45 * H + fs * 1.85);
        g.stroke();
      }
    };
  })();

  var S4 = function (g, t, W, H, s, P, F, state) {
    var cx = 0.5 * W, cy = 0.4 * H;
    enso(g, cx, cy, 0.075 * H, 0.019 * H, easeInOut((t - 24.0) / 1.0), P.ink, 0.5, 71);
    var a = easeOut((t - 24.45) / 0.9);
    var fs = Math.round(0.062 * H);
    g.font = "italic 400 " + fs + "px " + F.display;
    g.textAlign = "center";
    g.textBaseline = "alphabetic";
    var y = 0.63 * H + (1 - a) * 8 * s;
    var tw = g.measureText("Open Exhibits").width;
    g.fillStyle = rgba(P.gold, a);
    g.fillText("Open Exhibits", cx, y);
    var u = easeOut((t - 25.0) / 0.9);
    if (u > 0) {
      g.strokeStyle = rgba(P.gold, 0.7);
      g.lineWidth = Math.max(0.7, 1 * s);
      g.beginPath();
      g.moveTo(cx - tw / 2 * u, y + fs * 0.28);
      g.lineTo(cx + tw / 2 * u, y + fs * 0.28);
      g.stroke();
    }
    if (state) state.cta = { x: (cx - tw / 2 - 14 * s) / W, y: (y - fs * 1.05) / H, w: (tw + 28 * s) / W, h: (fs * 1.55) / H, on: a > 0.5 };
  };

  function fit(g, text, size, weight, family, maxW) {
    var fs = size;
    g.font = weight + " " + Math.round(fs) + "px " + family;
    var w = g.measureText(text).width;
    if (w > maxW) { fs = fs * maxW / w; g.font = weight + " " + Math.round(fs) + "px " + family; }
    return fs;
  }

  var S5 = function (g, t, W, H, s, P, F, state) {
    var t0 = WN.start, cx = 0.5 * W;
    var rx = 0.86 * W, ry = 0.2 * H;
    for (var k = 0; k < 5; k++) {
      var rr = (0.03 + k * 0.035 + Math.max(0, t - t0 + 0.55) * 0.01) * H;
      g.strokeStyle = rgba(P.ink, 0.13 * (1 - k / 5) * sm((t - t0 + 0.4) / 1.2));
      g.lineWidth = Math.max(0.6, 1 * s);
      g.beginPath(); g.ellipse(rx, ry, rr * 1.3, rr * 0.55, 0, 0, TAU); g.stroke();
    }
    g.textBaseline = "alphabetic";
    var ka = easeOut((t - t0 + 0.2) / 0.9);
    g.fillStyle = rgba(P.ink, 0.6 * ka);
    g.font = "400 " + Math.round(0.03 * H) + "px " + F.ui;
    spaced(g, (WN.kicker || "").toUpperCase(), cx, 0.3 * H, 0.008 * H);
    var ru = easeOut((t - t0 - 0.1) / 1.2);
    if (ru > 0) {
      g.strokeStyle = rgba(P.gold, 0.75);
      g.lineWidth = Math.max(0.7, 1 * s);
      g.beginPath();
      g.moveTo(cx - 0.035 * W * ru, 0.345 * H);
      g.lineTo(cx + 0.035 * W * ru, 0.345 * H);
      g.stroke();
    }
    var la = easeOut((t - t0 - 0.35) / 1.0);
    g.textAlign = "center";
    fit(g, WN.line, 0.06 * H, "300", F.display, 0.84 * W);
    g.fillStyle = rgba(P.ink, 0.95 * la);
    g.fillText(WN.line, cx, 0.49 * H + (1 - la) * 8 * s);
    var a = easeOut((t - t0 - 1.6) / 0.9);
    var fs = fit(g, WN.link, 0.062 * H, "italic 400", F.display, 0.8 * W);
    var y = 0.665 * H + (1 - a) * 8 * s;
    var tw = g.measureText(WN.link).width;
    g.fillStyle = rgba(P.gold, a);
    g.fillText(WN.link, cx, y);
    var u = easeOut((t - t0 - 2.1) / 0.9);
    if (u > 0) {
      g.strokeStyle = rgba(P.gold, 0.7);
      g.lineWidth = Math.max(0.7, 1 * s);
      g.beginPath();
      g.moveTo(cx - tw / 2 * u, y + fs * 0.28);
      g.lineTo(cx + tw / 2 * u, y + fs * 0.28);
      g.stroke();
    }
    if (WN.issue) {
      var ia = easeOut((t - t0 - 2.6) / 1.0);
      fit(g, "Latest: " + WN.issue, 0.028 * H, "400", F.ui, 0.7 * W);
      g.fillStyle = rgba(P.ink, 0.5 * ia);
      g.fillText("Latest: " + WN.issue, cx, 0.78 * H);
    }
    if (state) state.link = { x: (cx - tw / 2 - 14 * s) / W, y: (y - fs * 1.05) / H, w: (tw + 28 * s) / W, h: (fs * 1.55) / H, on: a > 0.5 };
  };

  var SCENES = [S1, S2, S3, S4];
  var SETTLED = [5.9, 15.2, 23.6, 27.6];
  if (WN) { SCENES.push(S5); SETTLED.push(WN.start + 3.2); }

  function captionAt(t) {
    for (var i = 0; i < CUES.length; i++) if (t >= CUES[i].s && t <= CUES[i].e) return i;
    return -1;
  }

  /* ---------- music: soft pad, a few bells, generated on the fly ---------- */
  function midi(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  var CHORDS = [
    [0.0, 6.6, [50, 57, 61, 64, 66]],
    [6.2, 11.4, [47, 54, 57, 61, 62]],
    [11.0, 16.4, [43, 50, 54, 57, 59]],
    [16.0, 20.4, [52, 59, 62, 66, 67]],
    [20.0, 24.6, [43, 50, 54, 59, 64]],
    [24.2, 28.2, [50, 57, 64, 66, 69]]
  ];
  if (WN) CHORDS.push([28.0, DUR - 0.8, [50, 57, 62, 66, 69]]);
  var BELLS = [[0.55, 81, 0.05], [6.6, 78, 0.045], [6.95, 86, 0.03], [16.1, 71, 0.05], [16.12, 47, 0.07], [24.5, 86, 0.04], [25.0, 81, 0.03]];

  function Music() {
    var ac = null, out = null, verb = null, session = null, rec = null;
    function ensure() {
      if (ac) return ac;
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ac = new AC();
      out = ac.createGain();
      out.gain.value = 1;
      var comp = ac.createDynamicsCompressor();
      comp.threshold.value = -20; comp.ratio.value = 3; comp.attack.value = 0.02; comp.release.value = 0.4;
      out.connect(comp);
      comp.connect(ac.destination);
      ac._comp = comp;
      verb = ac.createConvolver();
      var len = Math.floor(ac.sampleRate * 3.4), buf = ac.createBuffer(2, len, ac.sampleRate);
      for (var ch = 0; ch < 2; ch++) {
        var d = buf.getChannelData(ch);
        for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.8);
      }
      verb.buffer = buf;
      var wet = ac.createGain();
      wet.gain.value = 0.5;
      verb.connect(wet);
      wet.connect(out);
      return ac;
    }
    function unlock() {
      if (!ensure()) return;
      if (ac.state === "suspended") ac.resume();
    }
    function pad(sess, freq, t0, t1, from, base, amp) {
      var startAt = Math.max(t0, from), att = t0 < from ? 0.6 : 2.2;
      var A = base + startAt, Z = base + t1;
      var env = ac.createGain();
      env.gain.setValueAtTime(0.0001, A);
      env.gain.linearRampToValueAtTime(amp, A + att);
      env.gain.setValueAtTime(amp, Math.max(A + att, Z - 0.01));
      env.gain.exponentialRampToValueAtTime(0.0001, Z + 2.6);
      var lp = ac.createBiquadFilter();
      lp.type = "lowpass"; lp.frequency.value = 1300; lp.Q.value = 0.4;
      lp.connect(env);
      [-7, 7].forEach(function (cents) {
        var o = ac.createOscillator();
        o.type = "triangle"; o.frequency.value = freq; o.detune.value = cents;
        o.connect(lp); o.start(A); o.stop(Z + 2.8);
        sess.nodes.push(o);
      });
      env.connect(sess.dry);
      env.connect(sess.send);
    }
    function bell(sess, t, m, amp, from, base) {
      if (t < from) return;
      var A = base + t, f = midi(m);
      var env = ac.createGain();
      env.gain.setValueAtTime(0.0001, A);
      env.gain.exponentialRampToValueAtTime(amp, A + 0.008);
      env.gain.exponentialRampToValueAtTime(0.0001, A + (m < 60 ? 1.4 : 3.2));
      [[1, 1], [2.01, 0.28], [3.98, 0.08]].forEach(function (h) {
        var o = ac.createOscillator(), gg = ac.createGain();
        o.type = "sine"; o.frequency.value = f * h[0]; gg.gain.value = h[1];
        o.connect(gg); gg.connect(env); o.start(A); o.stop(A + 3.4);
        sess.nodes.push(o);
      });
      env.connect(sess.dry);
      env.connect(sess.send);
    }
    function start(from, level) {
      stop(true);
      if (!ensure()) return;
      if (ac.state === "suspended") ac.resume();
      var sess = { nodes: [], g: ac.createGain(), dry: ac.createGain(), send: ac.createGain() };
      sess.dry.gain.value = 0.62; sess.send.gain.value = 0.55;
      sess.dry.connect(sess.g); sess.send.connect(verb);
      sess.g.connect(out);
      var now = ac.currentTime, base = now + 0.05 - from;
      sess.g.gain.setValueAtTime(0.0001, now);
      sess.g.gain.linearRampToValueAtTime(level, now + 0.25);
      var fadeA = base + DUR - 1.6;
      if (fadeA > now + 0.3) {
        sess.g.gain.setValueAtTime(level, fadeA);
        sess.g.gain.linearRampToValueAtTime(0.0001, base + DUR - 0.2);
      }
      CHORDS.forEach(function (c) {
        if (c[1] + 2.5 < from) return;
        c[2].forEach(function (m, i) { pad(sess, midi(m), c[0], c[1], from, base, i === 0 ? 0.05 : 0.032); });
      });
      // low drone
      if (from < DUR - 1) {
        var o = ac.createOscillator(), dg = ac.createGain();
        o.type = "sine"; o.frequency.value = midi(38);
        dg.gain.setValueAtTime(0.0001, now); dg.gain.linearRampToValueAtTime(0.045, now + 1.5);
        o.connect(dg); dg.connect(sess.dry); o.start(now); o.stop(base + DUR + 0.5);
        sess.nodes.push(o);
      }
      BELLS.forEach(function (b) { bell(sess, b[0], b[1], b[2], from, base); });
      sess.level = level;
      session = sess;
    }
    function stop(fast) {
      if (!session || !ac) return;
      var s = session;
      session = null;
      var now = ac.currentTime;
      try {
        s.g.gain.cancelScheduledValues(now);
        s.g.gain.setValueAtTime(s.g.gain.value, now);
        s.g.gain.linearRampToValueAtTime(0.0001, now + (fast ? 0.08 : 0.2));
      } catch (e) {}
      setTimeout(function () {
        s.nodes.forEach(function (n) { try { n.stop(); } catch (e) {} });
        try { s.g.disconnect(); } catch (e) {}
      }, 320);
    }
    function level(v) {
      if (!session || !ac) return;
      var now = ac.currentTime;
      try {
        session.g.gain.cancelScheduledValues(now);
        session.g.gain.setValueAtTime(session.g.gain.value, now);
        session.g.gain.linearRampToValueAtTime(Math.max(0.0001, v), now + 0.2);
      } catch (e) {}
    }
    function stream() {
      if (!ensure() || !ac.createMediaStreamDestination) return null;
      if (!rec) { rec = ac.createMediaStreamDestination(); ac._comp.connect(rec); }
      return rec.stream;
    }
    // the embedded soundtrack while saving a copy: speakers (via spk) + the recording, sample-accurate
    function track(buf, from, spkLevel) {
      if (!ensure() || !buf) return null;
      stream();
      var src = ac.createBufferSource(), spk = ac.createGain();
      src.buffer = buf;
      spk.gain.value = spkLevel;
      src.connect(spk); spk.connect(ac.destination);
      if (rec) src.connect(rec);
      var at = ac.currentTime + 0.06;
      src.start(at, Math.max(0, from));
      return {
        base: at - from,
        now: function () { return ac.currentTime; },
        level: function (v) { try { spk.gain.setTargetAtTime(v, ac.currentTime, 0.05); } catch (e) { spk.gain.value = v; } },
        stop: function () { try { src.stop(); } catch (e) {} try { src.disconnect(); spk.disconnect(); } catch (e) {} }
      };
    }
    function context() { return ensure(); }
    return { unlock: unlock, start: start, stop: stop, level: level, stream: stream, track: track, context: context };
  }

  /* ---------- soundtrack: the approved intro mix, embedded as base64 by intro-audio.js ---------- */
  function Track() {
    var src = WN ? WN.audio : window.INTRO_AUDIO;
    if (!src || !src.b64 || !window.Blob || !window.URL || !URL.createObjectURL || !window.atob) return null;
    var a;
    try { a = document.createElement("audio"); } catch (e) { return null; }
    if (!a.canPlayType || !a.canPlayType(src.type)) return null;
    var bytes;
    try {
      var bin = atob(src.b64);
      bytes = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    } catch (e) { return null; }
    a.preload = "auto";
    a.setAttribute("playsinline", "");
    a.src = URL.createObjectURL(new Blob([bytes], { type: src.type }));
    var decoded = null, waiting = null;
    return {
      el: a,
      // decoded copy for "Download" (recorded through Web Audio)
      buffer: function (ac, cb) {
        if (decoded || !ac) return cb(decoded);
        if (waiting) { waiting.push(cb); return; }
        waiting = [cb];
        var done = function (b) { decoded = b || null; var w = waiting; waiting = null; w.forEach(function (f) { f(decoded); }); };
        try {
          var pr = ac.decodeAudioData(bytes.buffer.slice(0), done, function () { done(null); });
          if (pr && pr.catch) pr.catch(function () { done(null); });
        } catch (e) { done(null); }
      }
    };
  }

  /* ---------- the player ---------- */
  var ICON = {
    play: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M8 5.5v13l10.5-6.5z"/></svg>',
    pause: '<svg viewBox="0 0 24 24"><path d="M8 5.5v13M16 5.5v13"/></svg>',
    replay: '<svg viewBox="0 0 24 24"><path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3"/><path d="M4.5 4.5v3.8h3.8"/></svg>',
    cc: '<svg viewBox="0 0 24 24"><rect x="3" y="5.5" width="18" height="13" rx="2.5"/><path d="M10.5 10.2a2.2 2.2 0 1 0 0 3.6M17 10.2a2.2 2.2 0 1 0 0 3.6"/></svg>',
    sound: '<svg viewBox="0 0 24 24"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/></svg>',
    muted: '<svg viewBox="0 0 24 24"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M16 9.5l5 5M21 9.5l-5 5"/></svg>',
    full: '<svg viewBox="0 0 24 24"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>',
    exit: '<svg viewBox="0 0 24 24"><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/></svg>'
  };

  function mount(el) {
    el.classList.add("film");
    el.tabIndex = 0;
    el.setAttribute("role", "region");
    el.setAttribute("aria-label", "Intro film, " + Math.round(DUR) + " seconds. Space plays or pauses.");
    el.innerHTML =
      '<div class="film-box">' +
      '<div class="film-stage">' +
        '<canvas class="film-canvas" aria-hidden="true"></canvas>' +
        '<a class="film-cta" href="#exhibits" tabindex="-1">Open Exhibits</a>' +
        (WN ? '<a class="film-cta film-log" href="' + WN.href.replace(/&/g, "&amp;").replace(/"/g, "&quot;") + '" tabindex="-1">' + WN.link.replace(/</g, "&lt;") + '</a>' : '') +
        '<button type="button" class="film-big" aria-label="Play intro">' + ICON.play + '</button>' +
        '<span class="film-load" aria-hidden="true">Loading</span>' +
      '</div>' +
      '<div class="film-bar">' +
        '<button type="button" class="film-btn" data-f="play" aria-label="Play">' + ICON.play + '</button>' +
        '<input class="film-seek" type="range" min="0" max="' + DUR + '" step="0.01" value="0" aria-label="Seek" />' +
        '<span class="film-time">0:00 / ' + fmt(DUR) + '</span>' +
        '<button type="button" class="film-btn on" data-f="cc" aria-label="Captions" aria-pressed="true">' + ICON.cc + '</button>' +
        '<button type="button" class="film-btn" data-f="sound" aria-label="Mute">' + ICON.sound + '</button>' +
        '<button type="button" class="film-btn" data-f="full" aria-label="Full screen">' + ICON.full + '</button>' +
      '</div>' +
      '</div>' +
      '<div class="film-strip" aria-hidden="true"><div class="film-strip-in"></div></div>';

    var stageEl = el.querySelector(".film-stage");
    var cv = el.querySelector(".film-canvas");
    var g = cv.getContext("2d");
    var cta = el.querySelector(".film-cta");
    var logA = el.querySelector(".film-log");
    var strip = el.querySelector(".film-strip");
    var stripIn = strip.querySelector(".film-strip-in");
    var phrases = null, phW = 0, curP = -1, curLine = null, curKey = -1;
    var big = el.querySelector(".film-big");
    var seek = el.querySelector(".film-seek");
    var timeEl = el.querySelector(".film-time");
    var btn = {};
    Array.prototype.forEach.call(el.querySelectorAll("[data-f]"), function (b) { btn[b.getAttribute("data-f")] = b; });

    var music = Music();
    var track = Track();
    var clock = "raf";          // "el": the embedded track drives time; "rec": saving a copy; "raf": no track, generated music
    var recSrc = null;          // Web Audio playback of the track while saving
    var elT = -1, elAt = 0;     // smoothing between the audio element's coarse currentTime updates

    var F = { display: '"Newsreader", "Iowan Old Style", Palatino, Georgia, serif', ui: '"Geist", ui-sans-serif, system-ui, sans-serif' };
    var P = palette();
    var paper = null, buffer = null;
    var W = 0, H = 0, S = 1;
    var st = { t: 0, playing: false, started: false, ended: false, cc: true, sound: true, recording: null, cta: null, cue: -1 };
    var last = 0, raf = 0, hideTimer = 0, lastEmit = 0, ccTouched = false;
    function setCC(on) {
      st.cc = on;
      strip.classList.toggle("off", !on);
      btn.cc.classList.toggle("on", on);
      btn.cc.setAttribute("aria-pressed", String(on));
      draw();
    }
    var rmq = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : { matches: false };

    function size(force) {
      var rect = stageEl.getBoundingClientRect();
      if (!rect.width) return;
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      var w, h;
      if (st.recording) { w = 1280; h = 720; }
      else { w = Math.round(rect.width * dpr); h = Math.round(w * 9 / 16); }
      if (!force && w === W && h === H && paper) return;
      W = w; H = h; S = H / 720;
      cv.width = W; cv.height = H;
      buffer = document.createElement("canvas");
      buffer.width = W; buffer.height = H;
      paper = makePaper(W, H, P);
      el.style.setProperty("--fs", (rect.width / 640).toFixed(3));
      draw();
    }

    function drawScene(ctx, k, t) {
      ctx.drawImage(paper, 0, 0, W, H);
      var at = rmq.matches ? SETTLED[k] : t;
      SCENES[k](ctx, at, W, H, S, P, F, ctx === g || ctx === buffer ? st : null);
    }

    function frameAt(t) {
      // which scene, and is it mid-crossfade?
      var k = 0;
      for (var i = BOUNDS.length - 1; i >= 0; i--) if (t >= BOUNDS[i] - 0.5) { k = i; break; }
      st.cta = null;
      st.link = null;
      var mix = k > 0 ? sm((t - (BOUNDS[k] - 0.5)) / 1.0) : 1;
      g.save();
      g.globalAlpha = 1;
      if (mix < 1) {
        drawScene(g, k - 1, t);
        var b = buffer.getContext("2d");
        b.clearRect(0, 0, W, H);
        drawScene(b, k, t);
        g.globalAlpha = mix;
        g.drawImage(buffer, 0, 0);
        g.globalAlpha = 1;
      } else {
        drawScene(g, k, t);
      }
      var black = sm((t - END_BLACK) / 0.5);
      if (black > 0) {
        g.fillStyle = "rgba(0,0,0," + black + ")";
        g.fillRect(0, 0, W, H);
        if (st.cta) st.cta.on = st.cta.on && black < 0.5;
        if (st.link) st.link.on = st.link.on && black < 0.5;
      }
      g.restore();
      // saving a copy with captions: picture on top, captions in their own band below (never over the picture)
      if (st.recording && st.recording.out) bandFrame(t);
    }

    var BAND = 80; // px under the 1280x720 picture in a captioned download (1280x800)
    function makeBandCanvas() {
      var c = document.createElement("canvas");
      c.width = 1280; c.height = 720 + BAND;
      var x = c.getContext("2d");
      x.fillStyle = "#0e0e0d"; x.fillRect(0, 0, c.width, c.height);
      return { cv: c, ctx: x };
    }
    function bandFrame(t) {
      var o = st.recording.out, c = o.ctx, w = o.cv.width;
      c.drawImage(cv, 0, 0, w, 720);
      c.fillStyle = "#0e0e0d";
      c.fillRect(0, 720, w, BAND);
      c.fillStyle = "rgba(255,255,255,0.08)";
      c.fillRect(0, 720, w, 1);
      var ci = captionAt(t);
      if (ci < 0) return;
      var text = CUES[ci].t, fs = 26, lines;
      for (; fs >= 18; fs -= 2) {
        c.font = "400 " + fs + "px " + F.ui;
        lines = wrapLines(c, text, w * 0.86);
        if (lines.length <= 2) break;
      }
      if (lines.length > 2) lines = [lines.slice(0, Math.ceil(lines.length / 2)).join(" "), lines.slice(Math.ceil(lines.length / 2)).join(" ")];
      var lh = fs * 1.3, y0 = 720 + BAND / 2 - (lines.length - 1) * lh / 2;
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.fillStyle = "rgba(246,246,244,0.96)";
      lines.forEach(function (l, i) { c.fillText(l, w / 2, y0 + i * lh); });
    }
    function wrapLines(c, text, maxW) {
      var words = text.split(" "), lines = [], line = "";
      words.forEach(function (wd) {
        var test = line ? line + " " + wd : wd;
        if (c.measureText(test).width > maxW && line) { lines.push(line); line = wd; } else line = test;
      });
      if (line) lines.push(line);
      return lines;
    }
    function roundRect(c, x, y, w, h, r) {
      c.beginPath();
      c.moveTo(x + r, y); c.lineTo(x + w - r, y); c.quadraticCurveTo(x + w, y, x + w, y + r);
      c.lineTo(x + w, y + h - r); c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      c.lineTo(x + r, y + h); c.quadraticCurveTo(x, y + h, x, y + h - r);
      c.lineTo(x, y + r); c.quadraticCurveTo(x, y, x + r, y);
      c.closePath();
    }

    function timeWords(c) {
      var ws = (c.words || c.t.split(/\s+/).filter(Boolean).map(function (w) { return { w: w }; })).map(function (x) { return { w: x.w, a: x.a, z: x.z }; });
      if (!ws.length) return ws;
      if (ws[0].a == null) ws[0].a = c.s;
      if (ws[ws.length - 1].z == null) ws[ws.length - 1].z = c.e;
      var punct = function (w) { return /[.?!]["”’]?$/.test(w) ? 2 : (/[,;:—–]$/.test(w) ? 1 : 0); };
      var i = 0, prevEnd = c.s;
      while (i < ws.length) {
        if (ws[i].a == null) ws[i].a = prevEnd;
        var j = i;
        while (ws[j].z == null && j + 1 < ws.length && ws[j + 1].a == null) j++;
        var g0 = ws[i].a, g1 = ws[j].z != null ? ws[j].z : ws[j + 1].a, wt = [], gap = [], tot = 0;
        for (var q = i; q <= j; q++) {
          var n = ws[q].w.replace(/[^0-9A-Za-z\u00C0-\u024F]/g, "").length + 1.5, p = q === j ? 0 : [0, 3.5, 9][punct(ws[q].w)];
          wt.push(n); gap.push(p); tot += n + p;
        }
        var k = Math.max(0, g1 - g0) / (tot || 1), at = g0;
        for (q = i; q <= j; q++) {
          ws[q].s = at; ws[q].e = at + wt[q - i] * k; ws[q].brk = punct(ws[q].w);
          at = ws[q].e + gap[q - i] * k;
        }
        ws[j].e = g1;
        prevEnd = g1;
        i = j + 1;
      }
      return ws;
    }
    function buildPhrases(maxW) {
      var cs = getComputedStyle(strip), m = document.createElement("canvas").getContext("2d");
      m.font = cs.getPropertyValue("--cap-font") || ("400 15px " + F.display);
      var sp = m.measureText(" ").width, out = [];
      CUES.forEach(function (c, ci) {
        var ws = timeWords(c), line = [], w = 0, lastComma = -1;
        function push(n) {
          var part = line.slice(0, n);
          out.push({ c: ci, words: part, s: part[0].s, e: part[part.length - 1].e });
          line = line.slice(n); w = 0; lastComma = -1;
          line.forEach(function (x, j) { w += (j ? sp : 0) + x.mw; if (x.brk === 1) lastComma = j; });
        }
        ws.forEach(function (x) {
          x.mw = m.measureText(x.w).width;
          var nw = w + (line.length ? sp : 0) + x.mw;
          if (line.length && nw > maxW) push(lastComma >= 2 && lastComma < line.length - 1 ? lastComma + 1 : line.length);
          w += (line.length ? sp : 0) + x.mw;
          line.push(x);
          if (x.brk === 1) lastComma = line.length - 1;
          if (x.brk === 2 && line.length >= 4) push(line.length);
        });
        if (line.length) push(line.length);
      });
      out.forEach(function (p, i) {
        var n = out[i + 1], cue = CUES[p.c];
        p.from = p.s - 0.12;
        p.to = (n && n.c === p.c) ? n.s - 0.12 : Math.min(cue.e + 0.6, n ? n.s - 0.3 : DUR);
      });
      return out;
    }
    function showPhrase(i) {
      var old = curLine;
      if (old) { old.classList.add("out"); setTimeout(function () { if (old.parentNode) old.parentNode.removeChild(old); }, 650); }
      curLine = null; curP = i; curKey = -1;
      if (i < 0) return;
      var ln = document.createElement("div");
      ln.className = "cap-line in";
      phrases[i].words.forEach(function (x, j) {
        if (j) ln.appendChild(document.createTextNode(" "));
        var s = document.createElement("span");
        s.className = "w";
        s.textContent = x.w;
        ln.appendChild(s);
      });
      stripIn.appendChild(ln);
      void ln.offsetWidth;
      ln.classList.remove("in");
      curLine = ln;
    }
    function updateStrip(t) {
      var wNow = stripIn.clientWidth;
      if (!wNow) return;
      if (!phrases || wNow !== phW) {
        phW = wNow;
        phrases = buildPhrases(Math.max(120, wNow - 32));
        if (curLine) { curLine.remove(); curLine = null; }
        curP = -1;
      }
      var pi = -1;
      if (t >= 0) for (var i = 0; i < phrases.length; i++) if (t >= phrases[i].from && t < phrases[i].to) { pi = i; break; }
      if (pi !== curP) showPhrase(pi);
      if (pi < 0 || !curLine) return;
      var ws = phrases[pi].words, k = 0, inside = 0;
      for (var j = 0; j < ws.length; j++) if (t >= ws[j].s) { k = j + 1; inside = t < ws[j].e ? 1 : 0; }
      var key = k * 2 + inside;
      if (key === curKey) return;
      curKey = key;
      var spans = curLine.querySelectorAll(".w");
      for (var q = 0; q < spans.length; q++) {
        spans[q].classList.toggle("said", q < k - inside);
        spans[q].classList.toggle("now", inside === 1 && q === k - 1);
      }
    }
    function loadVTT() {
      var src = el.getAttribute("data-vtt");
      if (!src || !window.fetch) return;
      fetch(src).then(function (r) { return r.ok ? r.text() : ""; }).then(function (txt) {
        var sec = function (v) { var p = v.split(":"), s = 0; for (var i = 0; i < p.length; i++) s = s * 60 + parseFloat(p[i]); return s; };
        var out = [];
        txt.replace(/\r/g, "").split(/\n\s*\n/).forEach(function (b) {
          var m = b.match(/((?:\d+:)?\d+:\d+\.\d+)\s+-->\s+((?:\d+:)?\d+:\d+\.\d+)[^\n]*\n([\s\S]+)/);
          if (!m) return;
          var body = m[3].replace(/<(?!\d)[^>]*>/g, "").replace(/\s+/g, " ").trim(), words = [], pend = null, re = /<(\d[\d:.]*)>|([^\s<]+)/g, x;
          while ((x = re.exec(body))) {
            if (x[1]) {
              if (words.length && x.index > 0 && body.charAt(x.index - 1) !== " ") words[words.length - 1].z = sec(x[1]);
              else pend = sec(x[1]);
            } else { words.push({ w: x[2], a: pend }); pend = null; }
          }
          out.push({ s: sec(m[1]), e: sec(m[2]), t: words.map(function (w) { return w.w; }).join(" "), words: words });
        });
        if (!out.length) return;
        CUES.length = 0;
        out.forEach(function (c) { CUES.push(c); });
        phrases = null;
        draw();
      }).catch(function () {});
    }

    function draw() {
      if (!paper) return;
      var t = (!st.started && !st.playing && st.t === 0) ? POSTER_T : st.t;
      if (st.ended && !st.playing) t = END_T;
      frameAt(t);
      // DOM bits: captions + clickable "Open Exhibits"
      updateStrip(st.started ? st.t : -1);
      if (st.cta && st.cta.on && !st.recording) {
        cta.style.left = (st.cta.x * 100) + "%";
        cta.style.top = (st.cta.y * 100) + "%";
        cta.style.width = (st.cta.w * 100) + "%";
        cta.style.height = (st.cta.h * 100) + "%";
        cta.classList.add("on");
        cta.tabIndex = 0;
      } else {
        cta.classList.remove("on");
        cta.tabIndex = -1;
      }
      if (logA) {
        var lk = st.link;
        if (lk && lk.on && !st.recording) {
          logA.style.left = (lk.x * 100) + "%";
          logA.style.top = (lk.y * 100) + "%";
          logA.style.width = (lk.w * 100) + "%";
          logA.style.height = (lk.h * 100) + "%";
          logA.classList.add("on");
          logA.tabIndex = 0;
        } else {
          logA.classList.remove("on");
          logA.tabIndex = -1;
        }
      }
      seek.value = String(st.t);
      seek.style.setProperty("--p", (st.t / DUR * 100).toFixed(2) + "%");
      timeEl.textContent = fmt(st.t) + " / " + fmt(DUR);
    }

    function emit(type) {
      var ev;
      try { ev = new Event(type); } catch (e) { ev = document.createEvent("Event"); ev.initEvent(type, false, false); }
      el.dispatchEvent(ev);
    }

    function tick(now) {
      raf = 0;
      if (!st.playing) return;
      var dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (clock === "el") {
        var a = track.el;
        if (a.readyState >= 1) {
          var ct = a.currentTime;
          if (ct !== elT) { elT = ct; elAt = now; }
          st.t = Math.min(DUR, ct + (a.paused ? 0 : Math.min(0.25, (now - elAt) / 1000)));
          if (a.ended) st.t = DUR;
        }
      } else if (clock === "rec" && recSrc) {
        st.t = clamp(recSrc.now() - recSrc.base, 0, DUR);
        if (st.t >= track.el.duration - 0.02 || st.t >= DUR - 0.03) st.t = DUR;
      } else {
        st.t = Math.min(DUR, st.t + dt);
      }
      draw();
      if (now - lastEmit > 120) { lastEmit = now; emit("timeupdate"); }
      if (st.recording) st.recording.onProgress(st.t);
      if (st.t >= DUR) { finish(); return; }
      raf = requestAnimationFrame(tick);
    }

    function musicLevel() { return st.sound ? 0.8 : 0.0001; }
    function startSound() {
      if (st.recording && st.recording.buf) {
        clock = "rec";
        if (recSrc) recSrc.stop();
        recSrc = music.track(st.recording.buf, st.t, st.sound ? 1 : 0.0001);
        if (!recSrc) { clock = "raf"; music.start(st.t, musicLevel()); }
        return;
      }
      if (track && !st.recording) {
        clock = "el";
        var a = track.el;
        a.muted = !st.sound;
        elT = -1;
        try { if (a.readyState >= 1 && Math.abs(a.currentTime - st.t) > 0.05) a.currentTime = st.t; } catch (e) {}
        var pr;
        try { pr = a.play(); } catch (e) { pr = null; useFallback(); }
        if (pr && pr.catch) pr.catch(function () { if (st.playing && clock === "el") useFallback(); });
        return;
      }
      clock = "raf";
      music.start(st.t, musicLevel());
    }
    function useFallback() {
      // the embedded track wouldn't play here: keep the film running on its own clock with generated music
      clock = "raf";
      last = performance.now();
      music.start(st.t, musicLevel());
    }
    function stopSound() {
      if (track) try { track.el.pause(); } catch (e) {}
      if (recSrc) { recSrc.stop(); recSrc = null; }
      music.stop();
    }
    if (track) {
      track.el.addEventListener("loadedmetadata", function () {
        // a seek asked for before the track was ready
        if (clock === "el" && Math.abs(track.el.currentTime - st.t) > 0.1) try { track.el.currentTime = st.t; } catch (e) {}
      });
      track.el.addEventListener("ended", function () { if (st.playing && clock === "el") finish(); });
    }

    function play() {
      if (st.playing) return;
      if (st.ended || st.t >= DUR) { st.t = 0; st.ended = false; }
      st.playing = true;
      st.started = true;
      if (!track || st.recording) music.unlock();
      startSound();
      el.classList.add("playing");
      el.classList.remove("ended");
      btn.play.innerHTML = ICON.pause;
      btn.play.setAttribute("aria-label", "Pause");
      big.setAttribute("aria-label", "Pause intro");
      last = performance.now();
      if (!raf) raf = requestAnimationFrame(tick);
      peek();
      emit("play");
    }
    function pause() {
      if (!st.playing) return;
      st.playing = false;
      stopSound();
      el.classList.remove("playing");
      btn.play.innerHTML = ICON.play;
      btn.play.setAttribute("aria-label", "Play");
      big.innerHTML = ICON.play;
      big.setAttribute("aria-label", "Play intro");
      showBar();
      draw();
      emit("pause");
      emit("timeupdate");
      if (st.recording) st.recording.abort();
    }
    function finish() {
      st.playing = false;
      st.ended = true;
      stopSound();
      el.classList.remove("playing");
      el.classList.add("ended");
      btn.play.innerHTML = ICON.replay;
      btn.play.setAttribute("aria-label", "Replay");
      big.innerHTML = ICON.replay;
      big.setAttribute("aria-label", "Replay intro");
      showBar();
      draw();
      emit("timeupdate");
      emit("pause");
      emit("ended");
      if (st.recording) st.recording.done();
    }
    function setTime(v) {
      v = clamp(Number(v) || 0, 0, DUR);
      st.t = v;
      st.started = true;
      st.ended = v >= DUR;
      if (track) {
        elT = -1;
        try { if (track.el.readyState >= 1) track.el.currentTime = Math.min(v, track.el.duration || v); } catch (e) {}
      }
      if (st.playing && clock === "raf") music.start(v, musicLevel());
      if (st.playing && clock === "rec") startSound();
      draw();
      emit("timeupdate");
    }

    // controls
    function showBar() { el.classList.add("bar-on"); clearTimeout(hideTimer); }
    function peek() {
      el.classList.add("bar-on");
      clearTimeout(hideTimer);
      hideTimer = setTimeout(function () { if (st.playing && !el.matches(":focus-within") ) el.classList.remove("bar-on"); }, 2600);
    }
    showBar();

    function toggle() { if (st.playing) pause(); else play(); }
    big.addEventListener("click", function (e) { e.stopPropagation(); toggle(); });
    stageEl.addEventListener("click", function (e) {
      if (e.target.closest(".film-cta") || e.target.closest(".film-big")) return;
      if (st.playing && !el.classList.contains("bar-on")) { peek(); return; }
      toggle();
    });
    el.addEventListener("pointermove", function (e) { if (e.pointerType === "mouse") peek(); });
    btn.play.addEventListener("click", toggle);
    seek.addEventListener("input", function () { setTime(seek.value); peek(); });
    btn.cc.addEventListener("click", function () { ccTouched = true; setCC(!st.cc); });
    function setSound(on) {
      st.sound = !!on;
      btn.sound.innerHTML = st.sound ? ICON.sound : ICON.muted;
      btn.sound.setAttribute("aria-label", st.sound ? "Mute" : "Unmute");
      if (track) track.el.muted = !st.sound;
      if (recSrc) recSrc.level(st.sound ? 1 : 0.0001);
      music.level(musicLevel());
      emit("volumechange");
    }
    btn.sound.addEventListener("click", function () { setSound(!st.sound); });

    // full screen: native where allowed, a fixed overlay where not (iPhone)
    var holder = null;
    function isFull() { return document.fullscreenElement === el || document.webkitFullscreenElement === el || el.classList.contains("film-full"); }
    function setFullIcon() {
      var f = isFull();
      btn.full.innerHTML = f ? ICON.exit : ICON.full;
      btn.full.setAttribute("aria-label", f ? "Exit full screen" : "Full screen");
      setTimeout(function () { size(true); }, 60);
    }
    function enterFull() {
      var req = el.requestFullscreen || el.webkitRequestFullscreen;
      if (req) {
        try {
          var pr = req.call(el);
          if (pr && pr.catch) pr.catch(overlayFull);
          return;
        } catch (e) {}
      }
      overlayFull();
    }
    function overlayFull() {
      holder = document.createComment("film");
      el.parentNode.insertBefore(holder, el);
      document.body.appendChild(el);
      el.classList.add("film-full");
      el.focus({ preventScroll: true });
      setFullIcon();
    }
    function exitFull() {
      if (el.classList.contains("film-full")) {
        el.classList.remove("film-full");
        if (holder && holder.parentNode) { holder.parentNode.insertBefore(el, holder); holder.remove(); holder = null; }
        setFullIcon();
        return;
      }
      var ex = document.exitFullscreen || document.webkitExitFullscreen;
      if (ex) try { ex.call(document); } catch (e) {}
    }
    btn.full.addEventListener("click", function () { if (isFull()) exitFull(); else enterFull(); });
    document.addEventListener("fullscreenchange", setFullIcon);
    document.addEventListener("webkitfullscreenchange", setFullIcon);
    cta.addEventListener("click", function () { if (isFull()) exitFull(); pause(); });
    if (logA) logA.addEventListener("click", function () { if (isFull()) exitFull(); pause(); });
    if (WN && WN.feed && window.fetch) {
      var ctl = window.AbortController ? new AbortController() : null;
      var tmo = setTimeout(function () { if (ctl) ctl.abort(); }, 2000);
      fetch(WN.feed, ctl ? { signal: ctl.signal } : {}).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
        clearTimeout(tmo);
        var it = j && j.items && j.items[0];
        if (it && typeof it.title === "string" && it.title.trim()) { WN.issue = it.title.trim().slice(0, 90); draw(); }
      }).catch(function () { clearTimeout(tmo); });
    }

    loadVTT();
    el.addEventListener("keydown", function (e) {
      if (e.target !== el && e.target !== seek && !e.target.closest(".film-bar")) return;
      var k = e.key;
      if (k === " " || k === "k") { if (e.target.tagName === "BUTTON") return; e.preventDefault(); toggle(); }
      else if (k === "ArrowRight" && e.target !== seek) { e.preventDefault(); setTime(st.t + 5); }
      else if (k === "ArrowLeft" && e.target !== seek) { e.preventDefault(); setTime(st.t - 5); }
      else if (k === "c") btn.cc.click();
      else if (k === "m") btn.sound.click();
      else if (k === "f") btn.full.click();
      else if (k === "Escape" && el.classList.contains("film-full")) exitFull();
      else return;
      e.stopPropagation();
    });

    // keep it sharp when the frame resizes or the theme flips
    if ("ResizeObserver" in window) new ResizeObserver(function () { size(false); }).observe(stageEl);
    else window.addEventListener("resize", function () { size(false); });
    new MutationObserver(function () { P = palette(); size(true); }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    if (document.fonts && document.fonts.load) {
      Promise.all([document.fonts.load('300 40px "Newsreader"'), document.fonts.load('italic 400 40px "Newsreader"'), document.fonts.load('400 20px "Geist"')])
        .then(function () { phrases = null; draw(); }, function () {});
      if (document.fonts.ready) document.fonts.ready.then(function () { draw(); });
    }
    document.addEventListener("visibilitychange", function () { if (document.hidden && st.playing && !st.recording) pause(); });

    /* ---------- save a copy (records the film in real time) ---------- */
    function canSave() {
      return !!(window.MediaRecorder && cv.captureStream);
    }
    function pickMime() {
      var list = ["video/mp4;codecs=avc1,mp4a.40.2", "video/mp4", "video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];
      for (var i = 0; i < list.length; i++) if (MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(list[i])) return list[i];
      return "";
    }
    // onProgress(t, dur) while recording; then -1 = saved, -2 = couldn't record, -3 = stopped early
    function save(onProgress) {
      if (!canSave() || st.recording) return false;
      if (st.playing) pause();
      music.unlock();
      try { if (navigator.audioSession) navigator.audioSession.type = "playback"; } catch (e) {}
      st.recording = { pending: true, onProgress: function () {}, abort: function () {}, done: function () {} };
      if (track) track.buffer(music.context(), begin);
      else begin(null);
      return true;

      function begin(buf) {
        var mime = pickMime();
        var chunks = [], aborted = false, rec;
        var out = st.cc ? makeBandCanvas() : null;
        st.recording = {
          buf: buf,
          out: out,
          onProgress: function (t) { onProgress && onProgress(t, DUR); },
          abort: function () { aborted = true; stopRec(); },
          done: function () { stopRec(); }
        };
        size(true);
        draw();
        var stream = (out ? out.cv : cv).captureStream(30);
        var a = music.stream();
        if (a) a.getAudioTracks().forEach(function (tr) { stream.addTrack(tr); });
        try { rec = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 6000000 } : undefined); }
        catch (e) { st.recording = null; size(true); onProgress && onProgress(-2, DUR); return; }
        rec.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
        rec.onstop = function () {
          stream.getVideoTracks().forEach(function (tr) { tr.stop(); });
          st.recording = null;
          size(true);
          if (aborted || !chunks.length) { onProgress && onProgress(aborted ? -3 : -2, DUR); return; }
          onProgress && onProgress(-1, DUR);
          var type = rec.mimeType || mime || "video/webm";
          var blob = new Blob(chunks, { type: type.split(";")[0] });
          var url = URL.createObjectURL(blob);
          var link = document.createElement("a");
          link.href = url;
          link.download = "grokaiapps-intro." + (/mp4/.test(type) ? "mp4" : "webm");
          document.body.appendChild(link);
          link.click();
          setTimeout(function () { URL.revokeObjectURL(url); link.remove(); }, 4000);
        };
        function stopRec() { try { if (rec.state !== "inactive") rec.stop(); } catch (e) {} }
        st.t = 0; st.ended = false;
        rec.start(500);
        play();
      }
    }

    // make it quack like a <video>
    Object.defineProperty(el, "currentTime", { get: function () { return st.t; }, set: setTime, configurable: true });
    Object.defineProperty(el, "paused", { get: function () { return !st.playing; }, configurable: true });
    Object.defineProperty(el, "duration", { get: function () { return DUR; }, configurable: true });
    el.play = function () { play(); return Promise.resolve(); };
    el.pause = pause;
    el.canSave = canSave;
    el.saveCopy = save;
    el.setMuted = function (m) { setSound(!m); };
    Object.defineProperty(el, "muted", { get: function () { return !st.sound; }, configurable: true });
    el.renderAt = function (t) { st.started = true; st.t = clamp(t, 0, DUR); draw(); };

    size(true);

    // loading: soft pulse on the play button until the soundtrack and fonts are ready
    var readyFonts = !(document.fonts && document.fonts.ready), readyTrack = !track;
    function checkReady() { if (readyFonts && readyTrack) el.classList.remove("film-loading"); }
    el.classList.add("film-loading");
    if (track) {
      if (track.el.readyState >= 1) readyTrack = true;
      ["loadedmetadata", "canplaythrough", "error"].forEach(function (ev) {
        track.el.addEventListener(ev, function () { readyTrack = true; checkReady(); });
      });
    }
    if (!readyFonts) document.fonts.ready.then(function () { readyFonts = true; checkReady(); }, function () { readyFonts = true; checkReady(); });
    setTimeout(function () { readyFonts = readyTrack = true; checkReady(); }, 2500);
    el.addEventListener("play", function () { readyFonts = readyTrack = true; checkReady(); });
    checkReady();
    return el;
  }

  function init() {
    Array.prototype.forEach.call(document.querySelectorAll("[data-intro-film]"), mount);
  }
  window.IntroFilm = { mount: mount, init: init, CUES: CUES, DURATION: DUR };
  init();
})();
