(function () {
  "use strict";

  var SHARE_URL = "https://grokaiapps.com/#watch";
  var NAMES = ["watch", "about", "start", "exhibits", "gallery"];
  var ROUTES = { "exhibits/all": { tab: 3, sheet: "exhibits" }, "gallery/all": { tab: 4, sheet: "gallery" }, "tools/all": { tab: 2, sheet: "tools" } };

  var root = document.documentElement;
  var appEl = document.querySelector(".app");
  var stage = document.getElementById("stage");
  var panels = NAMES.map(function (n) { return document.getElementById(n); });
  var navLinks = Array.prototype.slice.call(document.querySelectorAll("[data-go]"));
  var video = document.getElementById("intro");
  var toastEl = document.getElementById("toast");
  var shareBtn = document.getElementById("share-btn");
  var shareNative = document.getElementById("share-native");

  var noop = function () {};
  var Snd = window.UISound || { play: noop, enabled: false, set: noop, toggle: noop, onChange: noop, holdWhile: noop };

  var current = -1;
  var toastTimer = 0;

  function reduceMotion() {
    return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }
  function isPhone() {
    return !!(window.matchMedia && window.matchMedia("(max-width: 899px)").matches);
  }
  function each(sel, fn, scope) { Array.prototype.forEach.call((scope || document).querySelectorAll(sel), fn); }

  /* ---------- progress bar ---------- */
  var progress = (function () {
    var bar = document.getElementById("progress"), fill = bar.firstElementChild, timers = [];
    function set(v) { fill.style.transform = "scaleX(" + v + ")"; }
    function clear() { timers.forEach(clearTimeout); timers = []; }
    function later(fn, ms) { timers.push(setTimeout(fn, ms)); }
    function start() {
      clear();
      bar.classList.add("on");
      bar.classList.remove("leaving");
      set(0.06);
      requestAnimationFrame(function () { set(0.38); });
    }
    function done() {
      clear();
      set(1);
      later(function () { bar.classList.remove("on"); }, 260);
      later(function () { set(0); }, 600);
    }
    function leave() {
      start();
      bar.classList.add("leaving");
      later(function () { set(0.62); }, 180);
      later(function () { set(0.8); }, 1100);
      later(function () { set(0.9); }, 2800);
    }
    function reset() { clear(); bar.classList.remove("on", "leaving"); set(0); }
    return { start: start, done: done, leave: leave, reset: reset, blip: function () { start(); later(done, 240); } };
  })();

  /* ---------- toast ---------- */
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove("show"); }, 1800);
  }

  /* ---------- sections ---------- */
  function parseHash() {
    var id = (location.hash || "#watch").replace(/^#/, "");
    if (ROUTES[id]) return ROUTES[id];
    var i = NAMES.indexOf(id.split("/")[0]);
    return { tab: i < 0 ? 0 : i, sheet: null };
  }

  function go(i, opts) {
    opts = opts || {};
    i = Math.max(0, Math.min(NAMES.length - 1, i));
    if (i === current) return;
    var first = current < 0;
    var dir = first ? 0 : (i > current ? 1 : -1);
    current = i;

    panels.forEach(function (panel, n) {
      var on = n === i;
      panel.hidden = !on;
      panel.classList.remove("enter");
      if (on && dir !== 0 && !reduceMotion()) {
        panel.style.setProperty("--dir", String(dir));
        void panel.offsetWidth;
        panel.classList.add("enter");
      }
    });
    navLinks.forEach(function (a) {
      if (Number(a.getAttribute("data-go")) === i) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
    if (video && i !== 0 && video.pause && !video.paused) video.pause();

    var id = NAMES[i];
    if (!openName && !opts.keepHash && location.hash !== "#" + id) history.replaceState(history.state, "", "#" + id);
    if (i === 3) requestAnimationFrame(layoutExhibits);
    if (!first) { Snd.play("tab"); progress.blip(); }
  }

  navLinks.forEach(function (a) {
    a.addEventListener("click", function (e) {
      e.preventDefault();
      if (openName) closeSheet({ silent: true });
      go(Number(a.getAttribute("data-go")));
    });
  });
  document.querySelector(".brand").addEventListener("click", function (e) {
    e.preventDefault();
    go(0);
  });

  document.addEventListener("keydown", function (e) {
    if (openName) return;
    if (e.target && e.target.closest && e.target.closest("video, .film, input, textarea, select, [contenteditable='true']")) return;
    if (e.key === "ArrowRight") { e.preventDefault(); go(current + 1); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); go(current - 1); }
  });

  function syncFromHash() {
    var r = parseHash();
    if (r.sheet) {
      go(r.tab, { keepHash: true });
      if (openName !== r.sheet) openSheet(r.sheet, { fromHash: true });
    } else {
      if (openName && sheets[openName].route) closeSheet({ noHistory: true });
      go(r.tab);
    }
  }
  window.addEventListener("popstate", syncFromHash);
  window.addEventListener("hashchange", syncFromHash);

  /* swipe between sections (ignored inside the exhibits pager while it can still move) */
  var sx = 0, sy = 0, st = 0, swipeOk = false;
  stage.addEventListener("touchstart", function (e) {
    if (e.touches.length !== 1) { swipeOk = false; return; }
    var t = e.touches[0];
    sx = t.clientX; sy = t.clientY; st = Date.now();
    swipeOk = !(e.target.closest && e.target.closest("video, .film, .quick, .watch-row"));
    var pages = e.target.closest && e.target.closest(".pages");
    if (pages && pages.scrollWidth > pages.clientWidth + 2) {
      pages._edgeL = pages.scrollLeft <= 2;
      pages._edgeR = pages.scrollLeft >= pages.scrollWidth - pages.clientWidth - 2;
      swipeOk = { pages: pages };
    }
  }, { passive: true });
  stage.addEventListener("touchend", function (e) {
    if (!swipeOk || openName) return;
    var t = e.changedTouches[0];
    var dx = t.clientX - sx, dy = t.clientY - sy;
    if (Date.now() - st > 700 || Math.abs(dx) < 56 || Math.abs(dx) < Math.abs(dy) * 1.6) return;
    if (swipeOk.pages) {
      if (dx < 0 && !swipeOk.pages._edgeR) return;
      if (dx > 0 && !swipeOk.pages._edgeL) return;
    }
    go(current + (dx < 0 ? 1 : -1));
  }, { passive: true });

  /* ---------- pop-ups (large on desktop, bottom sheets on phones) ---------- */
  var sheets = {};
  each(".sheet", function (el) {
    var name = el.id.replace(/^sheet-/, "");
    sheets[name] = { el: el, panel: el.querySelector(".sheet-panel"), body: el.querySelector(".sheet-body"), route: el.getAttribute("data-route") };
    el.querySelector(".sheet-panel").setAttribute("tabindex", "-1");
  });
  var openName = null, opener = null, pushed = false, closeTimer = 0;

  function focusables(rootEl) {
    return Array.prototype.slice.call(
      rootEl.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
    ).filter(function (el) {
      return !el.disabled && !el.closest("[hidden]") && el.getClientRects().length;
    });
  }

  function openSheet(name, o) {
    o = o || {};
    var sh = sheets[name];
    if (!sh || openName === name) return;
    if (openName) closeSheet({ silent: true, swap: true });
    clearTimeout(closeTimer);
    opener = o.opener || (document.activeElement !== document.body ? document.activeElement : null);
    openName = name;
    sh.el.hidden = false;
    sh.el.classList.remove("closing");
    sh.panel.style.transform = "";
    void sh.el.offsetWidth;
    sh.el.classList.add("open");
    root.classList.add("sheet-open");
    if ("inert" in appEl) appEl.inert = true;
    if (sh.body) sh.body.scrollTop = 0;
    setTimeout(function () { try { sh.panel.focus({ preventScroll: true }); } catch (e) { sh.panel.focus(); } }, 30);
    if (sh.route && !o.fromHash) {
      history.pushState({ sheet: name }, "", "#" + sh.route);
      pushed = true;
    } else if (!sh.route) {
      pushed = false;
    }
    initMedia(sh.el);
    Snd.play(sh.el.classList.contains("sheet-large") ? "open" : "select");
    progress.start();
    setTimeout(progress.done, 320);
    if (name === "transcript") syncTranscript(true);
  }

  function closeSheet(o) {
    o = o || {};
    if (!openName) return;
    var sh = sheets[openName];
    if (sh.route && !o.noHistory) {
      if (pushed && history.state && history.state.sheet === openName) {
        pushed = false;
        history.back();
        return;
      }
      history.replaceState(null, "", "#" + NAMES[current]);
    }
    if (sh.route) pushed = false;
    closeViewer(true);
    openName = null;
    if (sh.panel.style.transform) sh.panel.style.transform = isPhone() ? "translateY(100%)" : "";
    sh.el.classList.remove("open");
    sh.el.classList.add("closing");
    var el = sh.el;
    closeTimer = setTimeout(function () { el.hidden = true; el.classList.remove("closing"); sh.panel.style.transform = ""; }, reduceMotion() ? 0 : 300);
    if (!o.swap) {
      root.classList.remove("sheet-open");
      if ("inert" in appEl) appEl.inert = false;
      if (!o.silent) Snd.play(sh.el.classList.contains("sheet-large") ? "close" : "back");
      if (opener && opener.focus && document.contains(opener)) { try { opener.focus({ preventScroll: true }); } catch (e) {} }
      opener = null;
    }
  }

  document.addEventListener("click", function (e) {
    var t = e.target;
    var closer = t.closest && t.closest("[data-sheet-close]");
    if (closer && openName) { e.preventDefault(); closeSheet(); return; }
    var opener1 = t.closest && t.closest("[data-sheet]");
    if (opener1) { e.preventDefault(); openSheet(opener1.getAttribute("data-sheet"), { opener: opener1 }); return; }
    var link = t.closest && t.closest("[data-sheet-link]");
    if (link && !(e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button)) {
      e.preventDefault();
      openSheet(link.getAttribute("data-sheet-link"), { opener: link });
    }
  });

  document.addEventListener("keydown", function (e) {
    if (!openName) return;
    var sh = sheets[openName];
    if (e.key === "Escape") {
      e.preventDefault();
      if (viewerOpen) closeViewer();
      else closeSheet();
      return;
    }
    if (viewerOpen && (e.key === "ArrowRight" || e.key === "ArrowLeft")) {
      e.preventDefault();
      showViewer(vAt + (e.key === "ArrowRight" ? 1 : -1));
      return;
    }
    if (e.key !== "Tab") return;
    var list = focusables(viewerOpen ? document.getElementById("viewer") : sh.panel);
    if (!list.length) return;
    var first = list[0], last = list[list.length - 1];
    if (e.shiftKey && (document.activeElement === first || document.activeElement === sh.panel)) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  // drag a sheet down to close it (phones)
  Object.keys(sheets).forEach(function (name) {
    var sh = sheets[name], drag = null;
    sh.panel.addEventListener("touchstart", function (e) {
      if (!isPhone() || openName !== name || e.touches.length !== 1 || viewerOpen) return;
      var body = e.target.closest(".sheet-body");
      if (body && body.scrollTop > 0) return;
      drag = { y0: e.touches[0].clientY, t0: Date.now(), dy: 0, active: false, body: body };
    }, { passive: true });
    sh.panel.addEventListener("touchmove", function (e) {
      if (!drag) return;
      var dy = e.touches[0].clientY - drag.y0;
      if (!drag.active) {
        if (dy > 8 && (!drag.body || drag.body.scrollTop <= 0)) { drag.active = true; sh.el.classList.add("dragging"); }
        else if (dy < -6) { drag = null; return; }
        else return;
      }
      if (e.cancelable) e.preventDefault();
      drag.dy = Math.max(0, dy);
      sh.panel.style.transform = "translateY(" + drag.dy + "px)";
      sh.el.style.setProperty("--drag", Math.min(1, drag.dy / 320).toFixed(3));
    }, { passive: false });
    function end() {
      if (!drag) return;
      var d = drag;
      drag = null;
      sh.el.classList.remove("dragging");
      sh.el.style.removeProperty("--drag");
      if (!d.active) return;
      var v = d.dy / Math.max(1, Date.now() - d.t0);
      if (d.dy > 110 || v > 0.6) {
        sh.panel.style.transform = "translateY(" + d.dy + "px)";
        closeSheet();
      } else {
        sh.panel.style.transform = "";
      }
    }
    sh.panel.addEventListener("touchend", end, { passive: true });
    sh.panel.addEventListener("touchcancel", end, { passive: true });
  });

  /* ---------- gallery viewer (inside the gallery pop-up) ---------- */
  var viewer = document.getElementById("viewer");
  var vImg = document.getElementById("viewer-img");
  var vCap = document.getElementById("viewer-cap");
  var vFigs = Array.prototype.slice.call(document.querySelectorAll("#sheet-gallery .g-fig"));
  var vOrig = document.getElementById("viewer-orig");
  var viewerOpen = false, vAt = 0, vLast = null, vsx = 0, vToken = 0, vWarm = {};
  function largeOf(f) { var t = f.querySelector("img"); return f.getAttribute("data-large") || (t && (t.currentSrc || t.src)); }
  function warm(url) {
    // preload a neighbour's large copy so next/previous feel instant
    if (!url || vWarm[url]) return;
    var im = new Image();
    im.decoding = "async";
    im.src = url;
    vWarm[url] = im;
  }
  function fitViewer() {
    // size the frame to the large image's shape so the swap from thumb to large doesn't jump
    if (!viewerOpen) return;
    var f = vFigs[vAt], w = Number(f.getAttribute("data-lw")) || 1, h = Number(f.getAttribute("data-lh")) || 1;
    var cs = getComputedStyle(viewer);
    var aw = viewer.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    var ah = viewer.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    var k = Math.min(aw / w, ah / h, 1.6);
    vImg.style.width = Math.max(1, Math.floor(w * k)) + "px";
    vImg.style.height = Math.max(1, Math.floor(h * k)) + "px";
  }
  function showViewer(i) {
    vAt = (i + vFigs.length) % vFigs.length;
    var f = vFigs[vAt], thumb = f.querySelector("img"), url = largeOf(f), token = ++vToken;
    fitViewer();
    // the thumb (already loaded or loading) stands in, softly blurred, until the large copy is ready
    vImg.src = thumb.currentSrc || thumb.src;
    vImg.classList.add("v-low");
    vImg.alt = thumb.alt;
    viewer.classList.add("v-loading");
    viewer.setAttribute("aria-busy", "true");
    vCap.textContent = f.querySelector("figcaption").textContent;
    var orig = f.getAttribute("data-original");
    if (orig) { vOrig.href = orig; vOrig.hidden = false; } else vOrig.hidden = true;
    var big = vWarm[url] || new Image();
    vWarm[url] = big;
    var done = function () {
      if (token !== vToken) return;
      vImg.src = url;
      vImg.classList.remove("v-low");
      viewer.classList.remove("v-loading");
      viewer.removeAttribute("aria-busy");
    };
    var fail = function () {
      if (token !== vToken) return;
      vImg.classList.remove("v-low");
      viewer.classList.remove("v-loading");
      viewer.removeAttribute("aria-busy");
    };
    if (big.complete && big.naturalWidth && big.src) done();
    else {
      big.addEventListener("load", done, { once: true });
      big.addEventListener("error", fail, { once: true });
      if (!big.src) { big.decoding = "async"; big.src = url; }
    }
    warm(largeOf(vFigs[(vAt + 1) % vFigs.length]));
    warm(largeOf(vFigs[(vAt - 1 + vFigs.length) % vFigs.length]));
    Snd.play("tick");
  }
  window.addEventListener("resize", fitViewer);
  function openViewer(i) {
    vLast = document.activeElement;
    viewer.hidden = false;
    viewerOpen = true;
    showViewer(i);
    Snd.play("select");
    document.getElementById("viewer-close").focus();
  }
  function closeViewer(quiet) {
    if (!viewerOpen) return;
    viewer.hidden = true;
    viewerOpen = false;
    if (!quiet) {
      Snd.play("back");
      if (vLast && vLast.focus) vLast.focus();
    }
  }
  vFigs.forEach(function (f, i) {
    f.tabIndex = 0;
    f.setAttribute("role", "button");
    f.setAttribute("aria-label", "Open " + f.querySelector("figcaption").textContent);
    f.addEventListener("click", function () { openViewer(i); });
    f.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openViewer(i); } });
  });
  document.getElementById("viewer-close").addEventListener("click", function () { closeViewer(); });
  document.getElementById("viewer-prev").addEventListener("click", function () { showViewer(vAt - 1); });
  document.getElementById("viewer-next").addEventListener("click", function () { showViewer(vAt + 1); });
  viewer.addEventListener("click", function (e) { if (e.target === viewer) closeViewer(); });
  viewer.addEventListener("touchstart", function (e) { vsx = e.touches[0].clientX; }, { passive: true });
  viewer.addEventListener("touchend", function (e) {
    var dx = e.changedTouches[0].clientX - vsx;
    if (Math.abs(dx) > 50) showViewer(vAt + (dx < 0 ? 1 : -1));
  }, { passive: true });

  /* ---------- transcript follows the film ---------- */
  var lines = Array.prototype.slice.call(document.querySelectorAll("#transcript p[data-start]"));
  var tBody = document.getElementById("transcript");
  function syncTranscript(jump) {
    if (!video) return;
    var t = video.currentTime || 0, playing = !video.paused;
    lines.forEach(function (p) {
      var inLine = t >= Number(p.dataset.start) - 0.3 && t <= Number(p.dataset.end) + 0.9;
      var on = (playing || t > 0) && inLine;
      if (on && (!p.classList.contains("on") || jump) && openName === "transcript") {
        var top = p.offsetTop - tBody.offsetTop;
        if (top < tBody.scrollTop || top + p.offsetHeight > tBody.scrollTop + tBody.clientHeight) {
          tBody.scrollTo({ top: top - 8, behavior: reduceMotion() ? "auto" : "smooth" });
        }
      }
      p.classList.toggle("on", on);
    });
  }
  if (video) {
    video.addEventListener("timeupdate", function () { syncTranscript(false); });
    video.addEventListener("pause", function () { syncTranscript(false); });
    video.addEventListener("play", function () { syncTranscript(false); });
  }
  lines.forEach(function (p) {
    p.setAttribute("tabindex", "0");
    p.setAttribute("role", "button");
    var jump = function () {
      if (!video) return;
      Snd.play("select");
      try { video.currentTime = Number(p.dataset.start); } catch (err) {}
      var pr = video.play && video.play();
      if (pr && pr.catch) pr.catch(function () {});
      syncTranscript(true);
    };
    p.addEventListener("click", jump);
    p.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); jump(); }
    });
  });

  /* ---------- exhibits shelf: fit to the screen, page sideways ---------- */
  var exShelf = document.getElementById("ex-shelf");
  var exPages = document.getElementById("ex-pages");
  var exPager = document.getElementById("ex-pager");
  var exDots = document.getElementById("ex-dots");
  var exItems = Array.prototype.slice.call(exPages.querySelectorAll(".exhibit-card"));
  var exKey = "";

  function layoutExhibits() {
    var w = exShelf.clientWidth, h = exShelf.clientHeight;
    if (!w || !h) return;
    var n = exItems.length, cols, rows, gap, rowH, mode;
    if (w < 600) {
      mode = "list"; cols = 1; gap = 6;
      rows = Math.max(1, Math.floor((h + gap) / (78 + gap)));
      rows = Math.min(rows, n);
      if (rows < n && rows > 1) {
        var pagesNeeded = Math.ceil(n / rows);
        rows = Math.ceil(n / pagesNeeded);
      }
      rowH = Math.min(104, (h - (rows - 1) * gap) / rows);
    } else {
      mode = "tile"; gap = w < 900 ? 12 : 18;
      var textH = 64, best = null;
      var maxCols = Math.max(2, Math.min(5, Math.floor((w + gap) / (200 + gap))));
      for (var c = 2; c <= maxCols; c++) {
        var cw = (w - (c - 1) * gap) / c;
        for (var r = 1; r <= 4; r++) {
          if (c * r < n || (r - 1) * c >= n) continue;
          var ih = (h - (r - 1) * gap) / r - textH;
          var ratio = ih / cw;
          if (ratio < 0.36) continue;
          var score = n / (c * r) - Math.abs(Math.min(ratio, 0.75) - 0.56) * 0.6 + (cw >= 230 ? 0.05 : 0);
          if (!best || score > best.score) best = { c: c, r: r, cw: cw, score: score };
        }
      }
      if (!best) {
        var cw2 = (w - (maxCols - 1) * gap) / maxCols, rr = 1;
        for (var r2 = 1; r2 <= 4; r2++) {
          if ((h - (r2 - 1) * gap) / r2 - textH >= cw2 * 0.4) rr = r2;
        }
        best = { c: maxCols, r: rr, cw: cw2 };
      }
      cols = best.c; rows = best.r;
      rowH = Math.min((h - (rows - 1) * gap) / rows, best.cw * 0.75 + textH);
    }
    var per = cols * rows;
    var key = [mode, cols, rows, Math.round(rowH)].join("/");
    if (key === exKey) return;
    exKey = key;

    var keepPage = Math.round(exPages.scrollLeft / (exPages.clientWidth || 1));
    exPages.className = "pages laid mode-" + mode;
    exPages.innerHTML = "";
    var pageCount = Math.ceil(n / per);
    for (var p = 0; p < pageCount; p++) {
      var page = document.createElement("div");
      page.className = "page";
      page.style.setProperty("--gap", gap + "px");
      page.style.gridTemplateColumns = "repeat(" + cols + ", minmax(0, 1fr))";
      page.style.gridTemplateRows = "repeat(" + rows + ", " + rowH + "px)";
      exItems.slice(p * per, p * per + per).forEach(function (el) { page.appendChild(el); });
      exPages.appendChild(page);
    }

    exDots.innerHTML = "";
    exPager.hidden = pageCount < 2;
    for (var d = 0; d < pageCount; d++) {
      var b = document.createElement("button");
      b.type = "button";
      b.setAttribute("aria-label", "Exhibits page " + (d + 1) + " of " + pageCount);
      b.appendChild(document.createElement("i"));
      b.dataset.to = String(d);
      exDots.appendChild(b);
    }
    exPages.scrollLeft = Math.min(keepPage, pageCount - 1) * exPages.clientWidth;
    syncExDots();
  }

  var exLastPage = 0;
  function exPageIndex() {
    return Math.round(exPages.scrollLeft / (exPages.clientWidth || 1));
  }
  function syncExDots() {
    var i = exPageIndex();
    if (i !== exLastPage) { exLastPage = i; Snd.play("tick"); }
    Array.prototype.forEach.call(exDots.children, function (b, n) {
      if (n === i) b.setAttribute("aria-current", "true");
      else b.removeAttribute("aria-current");
    });
    var btns = exPager.querySelectorAll("[data-page]");
    if (btns.length) {
      btns[0].disabled = i <= 0;
      btns[1].disabled = i >= exDots.children.length - 1;
    }
  }
  function exGoTo(i) {
    exPages.scrollTo({ left: i * exPages.clientWidth, behavior: reduceMotion() ? "auto" : "smooth" });
  }
  exPages.addEventListener("scroll", function () { requestAnimationFrame(syncExDots); }, { passive: true });
  exDots.addEventListener("click", function (e) {
    var b = e.target.closest("button");
    if (b) exGoTo(Number(b.dataset.to));
  });
  exPager.querySelectorAll("[data-page]").forEach(function (b) {
    b.addEventListener("click", function () { exGoTo(exPageIndex() + Number(b.dataset.page)); });
  });
  if ("ResizeObserver" in window) {
    new ResizeObserver(function () { layoutExhibits(); }).observe(exShelf);
  } else {
    window.addEventListener("resize", layoutExhibits);
  }

  /* ---------- thumbnails: shimmer until loaded, fade in, quiet fallback ---------- */
  function initMedia(scope) {
    each(".media", function (m) {
      if (m._media) return;
      var img = m.querySelector("img");
      if (!img) return;
      m._media = true;
      var ok = function () { m.classList.add("loaded"); m.classList.remove("failed"); };
      var bad = function () {
        m.classList.add("failed");
        if (!m.getAttribute("data-fallback")) {
          var label = (m.closest("a, figure") || m).querySelector("h3, figcaption");
          m.setAttribute("data-fallback", label ? label.textContent.trim() : "");
        }
      };
      // already cached: show it now; otherwise wait for the image's own load/error (a lazy image that
      // hasn't started yet is not a failure, so no guessing from .complete here)
      img.addEventListener("load", ok);
      img.addEventListener("error", bad);
      if (img.complete && img.naturalWidth) ok();
    }, scope);
  }
  initMedia(document);

  /* ---------- exhibits and any link that leaves the page: show it's on the way ---------- */
  document.addEventListener("click", function (e) {
    if (e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target.closest && e.target.closest("a[href]");
    if (!a || a.hasAttribute("download") || a.target === "_blank") return;
    var href = a.getAttribute("href");
    if (!href || href.charAt(0) === "#" || /^(mailto|tel|sms):/i.test(href)) return;
    if (a.matches(".exhibit-card, .ex-card")) {
      e.preventDefault();
      a.classList.add("is-loading");
      a.setAttribute("aria-busy", "true");
      Snd.play("select");
      progress.leave();
      setTimeout(function () { location.href = a.href; }, reduceMotion() ? 0 : 140);
      return;
    }
    progress.leave();
  });
  window.addEventListener("pageshow", function () {
    progress.reset();
    each(".is-loading", function (a) { a.classList.remove("is-loading"); a.removeAttribute("aria-busy"); });
  });

  /* ---------- copy: link, prompt ---------- */
  function copyText(text) {
    return new Promise(function (resolve, reject) {
      var fallback = function () {
        var ta = document.createElement("textarea");
        ta.value = text;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        var ok = false;
        try { ok = document.execCommand("copy"); } catch (err) {}
        document.body.removeChild(ta);
        if (ok) resolve(); else reject();
      };
      if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(resolve, fallback);
      else fallback();
    });
  }
  function flashButton(btn, label) {
    var span = btn.querySelector("span");
    if (!span) return;
    if (!btn._label) btn._label = span.textContent;
    span.textContent = label;
    btn.classList.add("is-done");
    clearTimeout(btn._t);
    btn._t = setTimeout(function () { span.textContent = btn._label; btn.classList.remove("is-done"); }, 1600);
  }
  function doCopy(text, btns) {
    btns.forEach(function (b) { b.classList.add("is-busy"); });
    copyText(text).then(function () {
      btns.forEach(function (b) { b.classList.remove("is-busy"); flashButton(b, "Copied"); });
      Snd.play("copy");
      toast("Copied");
    }, function () {
      btns.forEach(function (b) { b.classList.remove("is-busy"); });
      Snd.play("error");
      toast("Copy didn’t work here");
    });
  }
  each("[data-copy-link]", function (el) {
    el.addEventListener("click", function (e) { e.preventDefault(); doCopy(SHARE_URL, [el]); });
  });
  var promptText = (document.getElementById("agent-prompt") || {}).textContent || "";
  var preview = document.getElementById("prompt-preview");
  if (preview) preview.textContent = promptText.split("\n\n")[0];
  each("[data-copy-prompt]", function (el) {
    el.addEventListener("click", function (e) { e.preventDefault(); doCopy(promptText, [el]); });
  });
  var toolsPrompt = document.getElementById("tools-prompt");
  if (toolsPrompt) toolsPrompt.textContent = promptText;
  each("[data-copy-text]", function (el) {
    el.addEventListener("click", function (e) { e.preventDefault(); doCopy(el.getAttribute("data-copy-text"), [el]); });
  });

  /* ---------- share: save the QR as a PNG, drawn from the inline SVG (no network) ---------- */
  var qrSvg = document.getElementById("share-qr");
  var qrSave = document.getElementById("qr-save");
  function saveBlob(blob, name) {
    var url = URL.createObjectURL(blob), a = document.createElement("a");
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 4000);
  }
  if (qrSvg && qrSave) {
    qrSave.addEventListener("click", function () {
      var src = new XMLSerializer().serializeToString(qrSvg);
      var svgBlob = new Blob([src], { type: "image/svg+xml" });
      var img = new Image(), size = 1024;
      var url = URL.createObjectURL(svgBlob);
      qrSave.classList.add("is-busy");
      var fallback = function () { qrSave.classList.remove("is-busy"); saveBlob(svgBlob, "grokaiapps-qr.svg"); toast("Saved"); };
      img.onload = function () {
        try {
          var cv = document.createElement("canvas");
          cv.width = cv.height = size;
          var g = cv.getContext("2d");
          g.fillStyle = "#fff"; g.fillRect(0, 0, size, size);
          g.imageSmoothingEnabled = false;
          g.drawImage(img, 0, 0, size, size);
          URL.revokeObjectURL(url);
          if (!cv.toBlob) return fallback();
          cv.toBlob(function (png) {
            qrSave.classList.remove("is-busy");
            if (!png) return fallback();
            saveBlob(png, "grokaiapps-qr.png");
            Snd.play("select");
            toast("Saved");
          }, "image/png");
        } catch (e) { fallback(); }
      };
      img.onerror = function () { URL.revokeObjectURL(url); fallback(); };
      img.src = url;
    });
  }

  /* ---------- download: record the film into a video file ---------- */
  var saveBtns = Array.prototype.slice.call(document.querySelectorAll("[data-film-save]"));
  if (!video || !video.canSave || !video.canSave()) {
    saveBtns.forEach(function (b) { b.hidden = true; });
  } else {
    saveBtns.forEach(function (b) {
      b.addEventListener("click", function () {
        if (openName) closeSheet({ silent: true });
        if (current !== 0) go(0);
        var started = video.saveCopy(function (t, dur) {
          saveBtns.forEach(function (x) {
            var label = x.querySelector("span");
            if (t < 0) { label.textContent = "Download"; x.disabled = false; x.classList.remove("is-busy"); }
            else { label.textContent = "Saving " + Math.ceil(dur - t) + "s"; x.disabled = true; x.classList.add("is-busy"); }
          });
          if (t === -1) { toast("Saved"); Snd.play("copy", { force: true }); }
          else if (t === -2) { toast("This browser can’t save the video"); Snd.play("error", { force: true }); }
        });
        if (started) {
          saveBtns.forEach(function (x) { x.classList.add("is-busy"); });
          toast("Recording the intro — keep this tab open");
        } else {
          Snd.play("error");
          toast("This browser can’t save the video");
        }
      });
    });
  }

  /* ---------- share ---------- */
  function nativeShare() {
    return navigator.share({ title: "GROKAIAPPS", text: "A starting place for using agentic tools well.", url: SHARE_URL });
  }
  // the home row's share icon is the one overflow: the sheet holds Share…, Copy link and Download
  shareBtn.addEventListener("click", function () { openSheet("share", { opener: shareBtn }); });
  if (navigator.share) {
    shareNative.hidden = false;
    shareNative.addEventListener("click", function () {
      nativeShare().then(function () { closeSheet(); }).catch(function (err) {
        if (err && err.name !== "AbortError") { toast("Share didn’t go through"); Snd.play("error"); }
      });
    });
  }

  /* ---------- sound toggle (covers the intro too) ---------- */
  var soundBtn = document.getElementById("sound-toggle");
  function paintSound(on) {
    soundBtn.setAttribute("aria-pressed", on ? "true" : "false");
    soundBtn.setAttribute("aria-label", on ? "Turn sound off" : "Turn sound on");
    soundBtn.classList.toggle("off", !on);
  }
  paintSound(Snd.enabled);
  soundBtn.addEventListener("click", function () {
    var on = Snd.toggle();
    paintSound(on);
    if (video && video.setMuted) video.setMuted(!on);
    toast(on ? "Sound on" : "Sound off");
  });
  try {
    if (localStorage.getItem("grokaiapps-sound") === "off" && video && video.setMuted) video.setMuted(true);
  } catch (e) {}
  if (video) {
    Snd.holdWhile(function () { return !video.paused; });
  }

  // a faint glass tick as focus moves between controls (mouse only)
  if (window.matchMedia && window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
    var lastHover = null;
    document.addEventListener("pointerover", function (e) {
      if (e.pointerType !== "mouse") return;
      var el = e.target.closest && e.target.closest("a[href], button, [role='button'], .exhibit-card, .ex-card, .g-fig");
      if (!el || el === lastHover || el.disabled) { if (!el) lastHover = null; return; }
      if (el.closest(".film")) return;
      lastHover = el;
      Snd.play("hover");
    });
  }

  /* ---------- theme ---------- */
  var themeToggle = document.getElementById("theme-toggle");
  function applyTheme(theme, save) {
    var dark = theme === "dark";
    root.setAttribute("data-theme", dark ? "dark" : "light");
    if (themeToggle) {
      themeToggle.setAttribute("aria-pressed", dark ? "true" : "false");
      themeToggle.setAttribute("aria-label", dark ? "Switch to day colors" : "Switch to night colors");
    }
    var meta = document.getElementById("theme-color");
    if (meta) meta.setAttribute("content", dark ? "#121212" : "#f3f3f1");
    if (save) {
      try { localStorage.setItem("grokaiapps-theme", dark ? "dark" : "light"); } catch (e) {}
    }
    pond.recolor();
  }

  /* ---------- pond: a quiet dot field that ripples where you tap ---------- */
  var pond = (function () {
    var cv = document.getElementById("pond");
    var ctx = cv && cv.getContext ? cv.getContext("2d") : null;
    var W = 0, H = 0, dpr = 1, gapPx = 20, dots = [], ripples = [], raf = 0;
    var base = "rgba(0,0,0,.1)", accent = "#8a6d43", baseA = 0.1;
    var SPEED = 0.36, BAND = 30, LIFE = 2600;

    function colors() {
      var cs = getComputedStyle(root);
      var fg = cs.getPropertyValue("--fg").trim() || "#141414";
      accent = cs.getPropertyValue("--accent").trim() || "#8a6d43";
      base = fg;
      baseA = root.getAttribute("data-theme") === "dark" ? 0.11 : 0.09;
    }
    function size() {
      if (!ctx) return;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = window.innerWidth; H = window.innerHeight;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      gapPx = W < 600 ? 19 : 23;
      dots = [];
      var ox = (W % gapPx) / 2, oy = (H % gapPx) / 2;
      for (var y = oy; y <= H; y += gapPx) {
        for (var x = ox; x <= W; x += gapPx) dots.push(x, y);
      }
      draw(performance.now());
    }
    function draw(now) {
      if (!ctx) return;
      ctx.clearRect(0, 0, W, H);
      ripples = ripples.filter(function (r) { return now - r.t < LIFE; });
      var hot = [];
      ctx.fillStyle = base;
      ctx.globalAlpha = baseA;
      ctx.beginPath();
      for (var i = 0; i < dots.length; i += 2) {
        var x = dots[i], y = dots[i + 1], amp = 0, dx = 0, dy = 0;
        for (var k = 0; k < ripples.length; k++) {
          var r = ripples[k], age = now - r.t;
          var ex = x - r.x, ey = y - r.y, d = Math.sqrt(ex * ex + ey * ey) || 1;
          var off = d - age * SPEED;
          if (off > BAND * 2.5 || off < -BAND * 2.5) continue;
          var a = Math.exp(-(off * off) / (2 * BAND * BAND)) * (1 - age / LIFE) * r.s;
          if (a < 0.02) continue;
          amp += a; dx += (ex / d) * a * 7; dy += (ey / d) * a * 7;
        }
        if (amp > 0.04) { hot.push(x + dx, y + dy, Math.min(1, amp)); continue; }
        ctx.moveTo(x + 0.9, y);
        ctx.arc(x, y, 0.9, 0, 6.2832);
      }
      ctx.fill();
      if (hot.length) {
        ctx.fillStyle = accent;
        for (var j = 0; j < hot.length; j += 3) {
          var am = hot[j + 2];
          ctx.globalAlpha = baseA + am * 0.6;
          ctx.beginPath();
          ctx.arc(hot[j], hot[j + 1], 0.9 + am * 1.5, 0, 6.2832);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
      if (ripples.length) raf = requestAnimationFrame(draw);
      else raf = 0;
    }
    function drop(x, y, strength) {
      if (!ctx || reduceMotion()) return;
      if (ripples.length > 5) ripples.shift();
      ripples.push({ x: x, y: y, t: performance.now(), s: strength || 1 });
      if (!raf) raf = requestAnimationFrame(draw);
    }
    if (ctx) {
      colors();
      window.addEventListener("resize", size);
      document.addEventListener("pointerdown", function (e) {
        if (openName || (e.target.closest && e.target.closest("video, .film"))) return;
        drop(e.clientX, e.clientY, 1);
      }, { passive: true });
    }
    return {
      init: size,
      drop: drop,
      recolor: function () { if (ctx) { colors(); draw(performance.now()); } }
    };
  })();

  var startTheme = root.getAttribute("data-theme") === "dark" ? "dark" : "light";
  applyTheme(startTheme, false);
  pond.init();
  if (themeToggle) {
    themeToggle.addEventListener("click", function () {
      applyTheme(root.getAttribute("data-theme") === "dark" ? "light" : "dark", true);
      Snd.play("tick");
    });
  }
  if (window.matchMedia) {
    var mq = window.matchMedia("(prefers-color-scheme: dark)");
    var onSys = function (e) {
      var saved = null;
      try { saved = localStorage.getItem("grokaiapps-theme"); } catch (err) {}
      if (saved !== "dark" && saved !== "light") applyTheme(e.matches ? "dark" : "light", false);
    };
    if (mq.addEventListener) mq.addEventListener("change", onSys);
  }

  syncFromHash();

  /* one slow welcome ripple from the mark */
  setTimeout(function () {
    var img = document.querySelector(".brand img");
    if (!img) return;
    var b = img.getBoundingClientRect();
    pond.drop(b.left + b.width / 2, b.top + b.height / 2, 0.8);
  }, 450);
})();
