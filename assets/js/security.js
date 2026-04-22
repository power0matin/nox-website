/* 
   Secure Runtime Guard
   Author: Matin Shahabadi
   Level: FINAL ENTERPRISE SHIELD v9.0
*/

(function () {
  "use strict";

  let locked = false;
  const DEV_THRESHOLD = 160;
  const CHECK_RATE = 120;

  // *** SHA-256 Utility برای Tamper-Proof ***
  async function sha256(str) {
    const buf = new TextEncoder().encode(str);
    const digest = await crypto.subtle.digest("SHA-256", buf);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  // *** سورس اصلی (برای self-heal & tamper-proof) ***
  const ORIGINAL_SOURCE = document.currentScript.textContent;

  // *** هش اصلی ***
  let ORIGINAL_HASH = null;
  sha256(ORIGINAL_SOURCE).then((h) => (ORIGINAL_HASH = h));

  // *** Shadow Guard Worker برای صحت‌سنجی مخفی ***
  let shadowWorker = null;
  function startShadowGuard() {
    try {
      const blob = new Blob([
        `
        onmessage = async (e)=>{
          const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(e.data.src));
          const arr = Array.from(new Uint8Array(hash)).map(b=>b.toString(16).padStart(2,"0")).join("");
          postMessage(arr);
        };
      `,
      ]);
      const url = URL.createObjectURL(blob);
      shadowWorker = new Worker(url);
    } catch {}
  }
  startShadowGuard();

  const SECURITY_HTML = `
  <body style="
  margin:0; padding:0; width:100vw; height:100vh;
  background:#000; display:flex; justify-content:center;
  align-items:center; font-family:'Segoe UI', Roboto, sans-serif;
  overflow:hidden; position:relative;
">

  <div style="
    position:absolute; width:900px; height:900px; border-radius:50%;
    background:radial-gradient(circle, rgba(200,0,0,0.22), transparent 65%);
    filter:blur(150px);
    animation:slowPulse 6s ease-in-out infinite;
  "></div>

  <div style="
    position:absolute; inset:0;
    background:url('data:image/svg+xml;utf8,<svg xmlns=\\"http://www.w3.org/2000/svg\\" width=\\"220\\" height=\\"220\\"><filter id=\\"n\\" x=\\"0\\" y=\\"0\\"><feTurbulence type=\\"fractalNoise\\" baseFrequency=\\"0.9\\" numOctaves=\\"4\\"/></filter><rect width=\\"220\\" height=\\"220\\" filter=\\"url(%23n)\\" opacity=\\"0.1\\" /></svg>');
    mix-blend-mode:overlay; opacity:0.19; pointer-events:none;
  "></div>

  <div style="
    width:540px; padding:60px; background:rgba(255,255,255,0.04);
    border:1px solid rgba(255,255,255,0.08);
    border-radius:22px; backdrop-filter:blur(22px) saturate(180%);
    box-shadow:0 0 80px rgba(255,0,0,0.32);
    animation:fadeIn 0.55s ease-out, floatUp 4s ease-in-out infinite;
    text-align:center; position:relative; z-index:3;
  ">

    <svg width="85" height="85" viewBox="0 0 24 24" fill="none"
         style="margin-bottom:25px;
                filter:drop-shadow(0 0 8px rgba(255,0,0,0.45));
                animation:shieldPulse 2.2s ease-in-out infinite;">
      <path d="M12 2L4 5V11C4 16.55 7.84 21.74 12 23C16.16 21.74 20 16.55 20 11V5L12 2Z"
            stroke="#ff4b4b" stroke-width="1.4"
            fill="rgba(255,80,80,0.25)"/>
    </svg>

    <div style="
      font-size:32px; color:#fff; font-weight:700; margin-bottom:12px;
      letter-spacing:1px; text-transform:uppercase;
    ">
      Security Enforcement Activated
    </div>

    <div style="
      font-size:17px; color:#d6d6d6; line-height:1.7; margin-bottom:28px;
    ">
      Unauthorized debugging or inspection attempt detected.<br>
      Integrity protection protocols have been enforced.
    </div>

    <div style="
      font-size:13px; color:#8c8c8c; margin-bottom:35px;
      letter-spacing:0.8px; text-transform:uppercase;
    ">
      Access to this environment is temporarily restricted.
    </div>

    <div style="position:relative; width:120px; height:120px; margin:auto;">
      <div style="
        position:absolute; inset:0; border-radius:50%;
        border:3px solid rgba(255,0,0,0.35);
        border-top-color:#ff3b3b;
        animation:spin 1.2s linear infinite;
      "></div>

      <div style="
        position:absolute; inset:12px; border-radius:50%;
        border:2px solid rgba(255,50,50,0.2);
        border-bottom-color:#ff2e2e;
        animation:spinReverse 2.5s linear infinite;
      "></div>
    </div>

  </div>

  <style>
    @keyframes fadeIn { from {opacity:0; transform:translateY(20px);} to {opacity:1; transform:translateY(0);} }
    @keyframes floatUp { 0%,100%{transform:translateY(0);} 50%{transform:translateY(-10px);} }
    @keyframes slowPulse { 0%{opacity:0.35; transform:scale(1);} 50%{opacity:0.6; transform:scale(1.15);} 100%{opacity:0.35; transform:scale(1);} }
    @keyframes shieldPulse { 0%{opacity:1;} 50%{opacity:0.75;} 100%{opacity:1;} }
    @keyframes spin { to { transform:rotate(360deg);} }
    @keyframes spinReverse { to { transform:rotate(-360deg);} }
  </style>

</body>
`; // بدون تغییر

  // ---[ 1) قفل نهایی ]--------------------------------
  function secureLock() {
    if (locked) return;
    locked = true;
    try {
      window.stop();
      const blob = new Blob([SECURITY_HTML], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      document.documentElement.innerHTML = "";
      window.location.replace(url);
    } catch (e) {}
  }

  // ---[ 2) تشخیص DevTools ]---------------------------
  function detectDevTools() {
    if (
      window.outerWidth - window.innerWidth > DEV_THRESHOLD ||
      window.outerHeight - window.innerHeight > DEV_THRESHOLD
    )
      return true;

    const s = performance.now();
    debugger;
    if (performance.now() - s > 100) return true;

    let trig = false;
    const img = new Image();
    Object.defineProperty(img, "id", { get: () => (trig = true) });
    console.log(img);
    if (trig) return true;

    return false;
  }

  // ---[ 3) مسدودسازی کنسول ]--------------------------
  function protectConsole() {
    const noop = () => {};
    ["log", "debug", "warn", "info", "error", "table", "trace", "dir"].forEach(
      (m) => (console[m] = noop),
    );
    Object.freeze(console);
  }

  // ---[ 4) جلوگیری از کلیدهای خطرناک ]---------------
  function protectKeys(e) {
    const k = (e.key || "").toLowerCase();
    const code = e.code;

    const ctrl = e.ctrlKey;
    const shift = e.shiftKey;
    const alt = e.altKey;
    const meta = e.metaKey;

    // ---- F12 ----
    if (k === "f12" || code === "F12") {
      e.preventDefault();
      e.stopImmediatePropagation();
      return secureLock();
    }

    // ---- Ctrl + Shift + I/J/C ----
    if (ctrl && shift && ["i", "j", "c"].includes(k)) {
      e.preventDefault();
      e.stopImmediatePropagation();
      return secureLock();
    }

    // ---- Ctrl + U (keydown) ----
    if (e.type === "keydown" && ctrl && k === "u") {
      // پیشگیری اولیه (ممکن است دیر باشد)
      e.preventDefault();
      e.stopImmediatePropagation();
      return true;
    }

    // ---- Ctrl + U (keyup) ----
    if (e.type === "keyup" && ctrl && k === "u") {
      // گارانتی ۱۰۰٪
      e.preventDefault();
      e.stopImmediatePropagation();
      return secureLock();
    }

    // ---- Ctrl + Shift + U ----
    if (ctrl && shift && k === "u") {
      e.preventDefault();
      e.stopImmediatePropagation();
      return secureLock();
    }

    // ---- MacOS cases ----
    if (meta && k === "u") {
      e.preventDefault();
      e.stopImmediatePropagation();
      return secureLock();
    }
  }

  // ---[ 5) جلوگیری از context/copy/paste/... ]--------
  ["contextmenu", "copy", "cut", "selectstart", "paste"].forEach((ev) =>
    document.addEventListener(ev, (e) => e.preventDefault(), true),
  );

  // // ---[ 6) تشخیص تغییر اندازه (DevTools dock) ]-------
  // window.addEventListener("resize", () => {
  //   if (detectDevTools()) secureLock();
  // });

  // // ---[ 7) جلوگیری از focus خروجی ]--------------------
  // window.addEventListener("blur", () => {
  //   setTimeout(() => {
  //     if (detectDevTools()) secureLock();
  //   }, 60);
  // });

  // ---[ 8) Anti-Breakpoint Timing Drift ]---------------
  function driftCheck() {
    const t1 = performance.now();
    setTimeout(() => {
      const diff = performance.now() - t1;
      // if (diff > 120) secureLock();
    }, 80);
  }
  setInterval(driftCheck, 200);

  // ---[ 9) Anti-Tamper + Self-Heal ]--------------------
  async function tamperCheck() {
    if (!ORIGINAL_HASH) return;
    const current = document.currentScript.textContent;
    const currentHash = await sha256(current);

    if (currentHash !== ORIGINAL_HASH) {
      // self‑heal
      secureLock();
    }

    // shadow verification
    if (shadowWorker) {
      shadowWorker.postMessage({ src: current });
      shadowWorker.onmessage = (ev) => {
        if (ev.data !== ORIGINAL_HASH) secureLock();
      };
    }
  }
  setInterval(tamperCheck, 250);

  // ---[ 10) Anti-Hook / Anti-Override ]-----------------
  function freezeGuards() {
    try {
      Object.freeze(detectDevTools);
      Object.freeze(secureLock);
      Object.freeze(protectKeys);
      Object.freeze(protectConsole);
    } catch {}
    try {
      Object.seal(window);
    } catch {}
  }
  freezeGuards();

  // ---[ 11) حلقه پایش ]-------------------------------
  function protectionLoop() {
    if (detectDevTools()) return secureLock();
    requestAnimationFrame(protectionLoop);
  }

  // ---[ 12) فعال‌سازی نهایی ]-------------------------
  window.addEventListener("keydown", protectKeys, true);
  window.addEventListener("keyup", protectKeys, true);
  window.addEventListener("keypress", protectKeys, true);
  protectConsole();
  requestAnimationFrame(protectionLoop);
  setInterval(() => {
    if (detectDevTools()) secureLock();
  }, CHECK_RATE);
})();
