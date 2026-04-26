/* ==========================================================
   Secure Runtime Guard — non-intrusive production signals
   ========================================================== */

(() => {
  "use strict";

  const CONFIG = {
    anomalyThreshold: 2,
    checkInterval: 3000,
    longTaskThreshold: 120,
  };

  let anomalyScore = 0;
  let lastCheck = performance.now();

  function reportAnomaly(type, extra = {}) {
    window.dispatchEvent(
      new CustomEvent("security-anomaly", {
        detail: {
          type,
          score: Number(anomalyScore.toFixed(2)),
          time: Date.now(),
          ...extra,
        },
      }),
    );
  }

  function addScore(amount, reason) {
    anomalyScore = Math.min(10, anomalyScore + amount);
    if (anomalyScore >= CONFIG.anomalyThreshold) {
      reportAnomaly(reason || "runtime_anomaly");
    }
  }

  function decayScore() {
    anomalyScore = Math.max(0, anomalyScore - 0.15);
  }

  function monitorMainThreadDelay() {
    const start = performance.now();

    window.setTimeout(() => {
      const delta = performance.now() - start;
      if (delta > CONFIG.longTaskThreshold) {
        addScore(0.25, "main_thread_blocked", { delta: Math.round(delta) });
      } else {
        decayScore();
      }
    }, 0);
  }

  function monitorVisibility() {
    if (document.hidden) addScore(0.1, "page_hidden");
  }

  function monitorShortcutSignals(event) {
    const key = String(event.key || "").toLowerCase();
    const isCtrl = event.ctrlKey || event.metaKey;
    const devtoolsLike = key === "f12" || (isCtrl && event.shiftKey && ["i", "j", "c"].includes(key));

    // No blocking: blocking DevTools hurts UX and does not provide real security.
    if (devtoolsLike) addScore(0.35, "developer_shortcut_signal");
  }

  function tick() {
    const now = performance.now();
    if (now - lastCheck < CONFIG.checkInterval) return;

    lastCheck = now;
    monitorMainThreadDelay();
  }

  document.addEventListener("visibilitychange", monitorVisibility);
  window.addEventListener("keydown", monitorShortcutSignals, true);
  window.setInterval(tick, CONFIG.checkInterval);
})();
