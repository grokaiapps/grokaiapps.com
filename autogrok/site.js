/* AUTOGROK Desk — People | Agents toggle (vanilla) */
(function () {
  var KEY = "autogrok-audience";
  var VALID = { people: 1, agents: 1 };

  function preferred() {
    try {
      var q = new URLSearchParams(location.search).get("view");
      if (q && VALID[q]) return q;
      var stored = localStorage.getItem(KEY);
      if (stored && VALID[stored]) return stored;
    } catch (e) {}
    return "people";
  }

  function setView(view) {
    if (!VALID[view]) view = "people";
    document.body.setAttribute("data-view", view);
    try { localStorage.setItem(KEY, view); } catch (e) {}

    var btns = document.querySelectorAll("[data-audience-btn]");
    for (var i = 0; i < btns.length; i++) {
      var on = btns[i].getAttribute("data-audience-btn") === view;
      btns[i].setAttribute("aria-selected", on ? "true" : "false");
      btns[i].tabIndex = on ? 0 : -1;
    }

    var panels = document.querySelectorAll("[data-audience]");
    for (var j = 0; j < panels.length; j++) {
      var match = panels[j].getAttribute("data-audience") === view;
      if (match) panels[j].removeAttribute("hidden");
      else panels[j].setAttribute("hidden", "");
    }
  }

  function wireAudience() {
    var root = document.querySelector(".audience-toggle");
    if (!root) return;

    root.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-audience-btn]");
      if (!btn) return;
      setView(btn.getAttribute("data-audience-btn"));
    });

    root.addEventListener("keydown", function (e) {
      var keys = { ArrowLeft: 1, ArrowRight: 1, Home: 1, End: 1 };
      if (!keys[e.key]) return;
      var btns = Array.prototype.slice.call(root.querySelectorAll("[data-audience-btn]"));
      if (!btns.length) return;
      var i = btns.findIndex(function (b) { return b.getAttribute("aria-selected") === "true"; });
      if (e.key === "ArrowLeft") i = (i - 1 + btns.length) % btns.length;
      if (e.key === "ArrowRight") i = (i + 1) % btns.length;
      if (e.key === "Home") i = 0;
      if (e.key === "End") i = btns.length - 1;
      e.preventDefault();
      btns[i].focus();
      setView(btns[i].getAttribute("data-audience-btn"));
    });

    setView(preferred());
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", wireAudience);
  } else {
    wireAudience();
  }
})();
