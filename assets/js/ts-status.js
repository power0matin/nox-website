/* ==========================================================
   NOX Roleplay TeamSpeak Status — single source of truth
   ========================================================== */

(() => {
  "use strict";

  const API_URL = "https://api.tsstatus.net/ts3.php?address=ts.nox-rp.ir";
  const REFRESH_INTERVAL = 15000;
  const TIMEOUT = 7000;

  const dot = document.getElementById("ts-dot");
  const text = document.getElementById("ts-text");
  const users = document.getElementById("ts-users-count");

  if (!dot || !text || !users) return;

  function setState(state, label, userCount = "--") {
    dot.className = `ts-dot ${state}`;
    text.textContent = label;
    users.textContent = String(userCount);
  }

  async function fetchStatus() {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), TIMEOUT);

    setState("loading", "در حال بررسی...", "--");

    try {
      const response = await fetch(API_URL, {
        method: "GET",
        cache: "no-store",
        signal: controller.signal,
        headers: { Accept: "application/json" },
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();
      const isOnline = data?.status === "online" || data?.online === true;
      const count = data?.virtualserver_clientsonline ?? data?.users ?? 0;

      if (!isOnline) {
        setState("offline", "آفلاین", 0);
        return;
      }

      setState("online", "آنلاین", count);
    } catch (_) {
      setState("offline", "اتصال برقرار نشد", "--");
    } finally {
      window.clearTimeout(timeoutId);
    }
  }

  fetchStatus();
  window.setInterval(fetchStatus, REFRESH_INTERVAL);
})();
