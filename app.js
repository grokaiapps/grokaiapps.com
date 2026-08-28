(function () {
  "use strict";

  var SHARE_URL = "https://grokaiapps.com/#watch";
  var NAMES = ["watch", "about", "start", "gallery"];

  var stage = document.getElementById("stage");
  var tabs = Array.prototype.slice.call(document.querySelectorAll('.tabs [role="tab"]'));
  var panels = Array.prototype.slice.call(document.querySelectorAll(".panel"));
  var dots = Array.prototype.slice.call(document.querySelectorAll(".dot"));
  var ink = document.querySelector(".tab-ink");
  var video = document.getElementById("intro");
  var toastEl = document.getElementById("toast");
  var overlay = document.getElementById("overlay");
  var shareDialog = document.getElementById("share-dialog");
  var aboutDialog = document.getElementById("about-dialog");
  var shareBtn = document.getElementById("share-btn");
  var shareNative = document.getElementById("share-native");

  var current = 0;
  var toastTimer = 0;
  var lastFocus = null;
  var activeDialog = null;
  var syncing = false;

  function reduceMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function indexFromHash() {
    var id = (location.hash || "#watch").replace(/^#/, "");
    var i = NAMES.indexOf(id);
    return i < 0 ? 0 : i;
  }

  function setChrome(i) {
    current = i;
    if (ink) ink.style.setProperty("--i", String(i));
    tabs.forEach(function (tab, n) {
      var on = n === i;
      tab.setAttribute("aria-selected", on ? "true" : "false");
      tab.tabIndex = on ? 0 : -1;
    });
    panels.forEach(function (panel, n) {
      var on = n === i;
      panel.classList.toggle("is-active", on);
      panel.setAttribute("aria-hidden", on ? "false" : "true");
      if ("inert" in panel) panel.inert = !on;
    });
    dots.forEach(function (dot, n) {
      if (n === i) dot.setAttribute("aria-current", "true");
      else dot.removeAttribute("aria-current");
    });
    if (video && i !== 0 && !video.paused) video.pause();
  }

  function go(i, opts) {
    opts = opts || {};
    i = Math.max(0, Math.min(NAMES.length - 1, i));
    setChrome(i);
    var id = NAMES[i];
    if (location.hash !== "#" + id) {
      history.replaceState(null, "", "#" + id);
    }
    if (!opts.fromScroll) {
      syncing = true;
      var behavior = reduceMotion() ? "auto" : "smooth";
      if (typeof panels[i].scrollIntoView === "function") {
        panels[i].scrollIntoView({ inline: "start", block: "nearest", behavior: behavior });
      }
      window.setTimeout(function () { syncing = false; }, 420);
    }
  }

  function nearestPanel() {
    var w = stage.clientWidth || 1;
    return Math.round(stage.scrollLeft / w);
  }

  stage.addEventListener("scroll", function () {
    if (syncing) return;
    var i = nearestPanel();
    if (i !== current) {
      setChrome(i);
      var id = NAMES[i];
      if (location.hash !== "#" + id) history.replaceState(null, "", "#" + id);
    }
  }, { passive: true });

  tabs.forEach(function (tab, i) {
    tab.addEventListener("click", function (e) {
      e.preventDefault();
      go(i);
      tab.focus();
    });
    tab.addEventListener("keydown", function (e) {
      var next = i;
      if (e.key === "ArrowRight") next = (i + 1) % tabs.length;
      else if (e.key === "ArrowLeft") next = (i - 1 + tabs.length) % tabs.length;
      else if (e.key === "Home") next = 0;
      else if (e.key === "End") next = tabs.length - 1;
      else return;
      e.preventDefault();
      go(next);
      tabs[next].focus();
    });
  });

  dots.forEach(function (dot, i) {
    dot.addEventListener("click", function () { go(i); });
  });

  document.addEventListener("keydown", function (e) {
    if (activeDialog) return;
    if (e.target && e.target.closest && e.target.closest("video, input, textarea, select, [contenteditable='true']")) return;
    if (e.key === "ArrowRight") { e.preventDefault(); go(current + 1); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); go(current - 1); }
  });

  window.addEventListener("hashchange", function () {
    go(indexFromHash(), { fromHash: true });
  });

  window.addEventListener("resize", function () {
    panels[current].scrollIntoView({ inline: "start", block: "nearest", behavior: "auto" });
  });

  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.hidden = false;
    toastEl.classList.add("show");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () {
      toastEl.classList.remove("show");
    }, 1800);
  }

  function copyShareUrl() {
    var done = function () { toast("Copied"); };
    var fallback = function () {
      var ta = document.createElement("textarea");
      ta.value = SHARE_URL;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      try {
        document.execCommand("copy");
        done();
      } catch (err) {
        toast("Copy failed");
      }
      document.body.removeChild(ta);
    };
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(SHARE_URL).then(done).catch(fallback);
    } else {
      fallback();
    }
  }

  document.querySelectorAll("[data-copy-link]").forEach(function (el) {
    el.addEventListener("click", function (e) {
      e.preventDefault();
      copyShareUrl();
    });
  });

  function focusables(root) {
    return Array.prototype.slice.call(
      root.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
    ).filter(function (el) {
      return !el.hasAttribute("disabled") && !el.hidden && el.getAttribute("aria-hidden") !== "true";
    });
  }

  function openDialog(dialog) {
    lastFocus = document.activeElement;
    activeDialog = dialog;
    overlay.hidden = false;
    shareDialog.hidden = dialog !== shareDialog;
    aboutDialog.hidden = dialog !== aboutDialog;
    var list = focusables(dialog);
    if (list[0]) list[0].focus();
  }

  function closeDialogs() {
    overlay.hidden = true;
    shareDialog.hidden = true;
    aboutDialog.hidden = true;
    activeDialog = null;
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  overlay.addEventListener("click", function (e) {
    if (e.target === overlay) closeDialogs();
  });

  overlay.addEventListener("keydown", function (e) {
    if (!activeDialog) return;
    if (e.key === "Escape") {
      e.preventDefault();
      closeDialogs();
      return;
    }
    if (e.key !== "Tab") return;
    var list = focusables(activeDialog);
    if (!list.length) return;
    var first = list[0];
    var last = list[list.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  });

  document.querySelectorAll("[data-close-dialog]").forEach(function (el) {
    el.addEventListener("click", closeDialogs);
  });

  document.querySelectorAll("[data-open-about]").forEach(function (el) {
    el.addEventListener("click", function () { openDialog(aboutDialog); });
  });

  if (navigator.share) {
    shareBtn.hidden = false;
    shareNative.hidden = false;
    shareBtn.addEventListener("click", function () { openDialog(shareDialog); });
    shareNative.addEventListener("click", function () {
      navigator.share({
        title: "GROKAIAPPS",
        text: "A starting place for using agentic tools well.",
        url: SHARE_URL
      }).then(closeDialogs).catch(function (err) {
        if (err && err.name !== "AbortError") toast("Share didn’t go through");
      });
    });
  }

  go(indexFromHash(), { fromScroll: false });
})();
