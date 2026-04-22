/*
   Secure Runtime Guard (Production Safe Version)
   Focus: Integrity signals + anomaly reporting (non-intrusive)
   Author: @power0matin -> https://github.com/power0matin
*/

(function () {
  "use strict";

  const CONFIG = {
    anomalyThreshold: 2,
    checkInterval: 2500,
    devtoolsDelayThreshold: 80,
  };

  let anomalyScore = 0;
  let lastCheck = 0;
  let sourceHash = null;

  async function sha256(str) {
    const buf = new TextEncoder().encode(str);
    const digest = await crypto.subtle.digest("SHA-256", buf);

    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  const SOURCE = document.currentScript?.textContent || "";

  sha256(SOURCE).then((h) => {
    sourceHash = h;
  });

  function reportAnomaly(type) {
    try {
      window.dispatchEvent(
        new CustomEvent("security-anomaly", {
          detail: {
            type,
            score: anomalyScore,
            time: Date.now(),
          },
        }),
      );
    } catch (e) {}
  }

  async function integrityCheck() {
    if (!sourceHash) return;

    const current = document.currentScript?.textContent || "";
    const currentHash = await sha256(current);

    if (currentHash !== sourceHash) {
      anomalyScore += 1;
    } else if (anomalyScore > 0) {
      anomalyScore -= 0.5;
    }

    if (anomalyScore >= CONFIG.anomalyThreshold) {
      reportAnomaly("script_tamper_detected");
    }
  }
  function devtoolsSignal() {
    const start = performance.now();

    queueMicrotask(() => {
      const delta = performance.now() - start;

      if (delta > CONFIG.devtoolsDelayThreshold) {
        anomalyScore += 0.3;
      }
    });
  }
  function handleKeydown(e) {
    const key = (e.key || "").toLowerCase();
    const isCtrl = e.ctrlKey || e.metaKey;

    const blocked =
      key === "f12" ||
      (isCtrl && key === "u") ||
      (isCtrl && e.shiftKey && ["i", "j", "c"].includes(key));

    if (blocked) {
      e.preventDefault();
      e.stopPropagation();

      anomalyScore += 1;
      reportAnomaly("devtools_shortcut_used");

      return false;
    }
  }

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      anomalyScore += 0.2;
    }
  });

  function monitor() {
    const now = performance.now();
    if (now - lastCheck < CONFIG.checkInterval) return;

    lastCheck = now;

    integrityCheck();
    devtoolsSignal();

    if (anomalyScore >= CONFIG.anomalyThreshold) {
      reportAnomaly("high_risk_environment");
    }
  }
  window.addEventListener("keydown", handleKeydown, true);

  setInterval(monitor, CONFIG.checkInterval);
})();
