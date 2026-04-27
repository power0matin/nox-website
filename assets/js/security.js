/* ==========================================================
   Secure Runtime Guard — non-intrusive production signals
   Image Guard — no copy / select / drag / context menu
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

  function addScore(amount, reason, extra = {}) {
    anomalyScore = Math.min(10, anomalyScore + amount);

    if (anomalyScore >= CONFIG.anomalyThreshold) {
      reportAnomaly(reason || "runtime_anomaly", extra);
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
        addScore(0.25, "main_thread_blocked", {
          delta: Math.round(delta),
        });
      } else {
        decayScore();
      }
    }, 0);
  }

  function monitorVisibility() {
    if (document.hidden) {
      addScore(0.1, "page_hidden");
    }
  }

  function monitorShortcutSignals(event) {
    const key = String(event.key || "").toLowerCase();
    const isCtrl = event.ctrlKey || event.metaKey;

    const devtoolsLike =
      key === "f12" ||
      (isCtrl && event.shiftKey && ["i", "j", "c"].includes(key));

    if (devtoolsLike) {
      addScore(0.35, "developer_shortcut_signal");
    }
  }

  function isImageTarget(target) {
    if (!(target instanceof Element)) return false;

    return Boolean(
      target.closest(
        [
          "img",
          "picture",
          "figure:has(img)",
          "a:has(img)",
          ".gallery-item",
          ".team-avatar",
          ".hero-logo",
          ".protected-image",
        ].join(","),
      ),
    );
  }

  function selectionContainsImage() {
    const selection = window.getSelection();

    if (!selection || selection.rangeCount === 0) return false;

    for (let i = 0; i < selection.rangeCount; i += 1) {
      const range = selection.getRangeAt(i);
      const container = document.createElement("div");

      container.appendChild(range.cloneContents());

      if (container.querySelector("img, picture, svg image")) {
        return true;
      }
    }

    return false;
  }

  function blockImageAction(event, reason) {
    event.preventDefault();
    event.stopPropagation();

    addScore(0.05, reason);

    return false;
  }

  function protectExistingImages() {
    document.querySelectorAll("img").forEach((img) => {
      img.setAttribute("draggable", "false");
      img.setAttribute("loading", img.getAttribute("loading") || "lazy");

      img.style.webkitUserDrag = "none";
      img.style.webkitUserSelect = "none";
      img.style.userSelect = "none";
    });
  }

  function initImageProtection() {
    protectExistingImages();

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (!(node instanceof Element)) return;

          if (node.matches("img")) {
            node.setAttribute("draggable", "false");
            node.style.webkitUserDrag = "none";
            node.style.webkitUserSelect = "none";
            node.style.userSelect = "none";
          }

          node.querySelectorAll?.("img").forEach((img) => {
            img.setAttribute("draggable", "false");
            img.style.webkitUserDrag = "none";
            img.style.webkitUserSelect = "none";
            img.style.userSelect = "none";
          });
        });
      });
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });

    document.addEventListener(
      "contextmenu",
      (event) => {
        if (isImageTarget(event.target)) {
          blockImageAction(event, "image_context_menu_blocked");
        }
      },
      true,
    );

    document.addEventListener(
      "dragstart",
      (event) => {
        if (isImageTarget(event.target)) {
          blockImageAction(event, "image_drag_blocked");
        }
      },
      true,
    );

    document.addEventListener(
      "selectstart",
      (event) => {
        if (isImageTarget(event.target)) {
          blockImageAction(event, "image_select_blocked");
        }
      },
      true,
    );

    document.addEventListener(
      "copy",
      (event) => {
        if (isImageTarget(event.target) || selectionContainsImage()) {
          blockImageAction(event, "image_copy_blocked");
        }
      },
      true,
    );

    document.addEventListener(
      "cut",
      (event) => {
        if (isImageTarget(event.target) || selectionContainsImage()) {
          blockImageAction(event, "image_cut_blocked");
        }
      },
      true,
    );

    document.addEventListener(
      "mousedown",
      (event) => {
        if (event.button === 2 && isImageTarget(event.target)) {
          blockImageAction(event, "image_right_click_blocked");
        }
      },
      true,
    );
  }

  function tick() {
    const now = performance.now();

    if (now - lastCheck < CONFIG.checkInterval) return;

    lastCheck = now;
    monitorMainThreadDelay();
  }

  document.addEventListener("visibilitychange", monitorVisibility);
  window.addEventListener("keydown", monitorShortcutSignals, true);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initImageProtection, {
      once: true,
    });
  } else {
    initImageProtection();
  }

  window.setInterval(tick, CONFIG.checkInterval);
})();
