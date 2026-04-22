/* ===============================
   Mobile Navigation Toggle
================================ */
document.addEventListener("DOMContentLoaded", () => {
  const hamburger = document.getElementById("hamburger");
  const navLinks = document.getElementById("navLinks");
  const mobileOverlay = document.getElementById("mobileOverlay");

  function openMenu() {
    hamburger.classList.add("active");
    navLinks.classList.add("open");
    mobileOverlay.classList.add("show");
  }

  function closeMenu() {
    hamburger.classList.remove("active");
    navLinks.classList.remove("open");
    mobileOverlay.classList.remove("show");
  }

  hamburger.addEventListener("click", () => {
    navLinks.classList.contains("open") ? closeMenu() : openMenu();
  });

  mobileOverlay.addEventListener("click", closeMenu);

  document.querySelectorAll(".nav-links a").forEach((link) => {
    link.addEventListener("click", closeMenu);
  });
});

/* ===============================
   Smooth Scroll for Anchor Links
================================ */
document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
  anchor.addEventListener("click", function (e) {
    const targetId = this.getAttribute("href");

    if (targetId === "#") return;

    const targetElement = document.querySelector(targetId);

    if (targetElement) {
      e.preventDefault();

      targetElement.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  });
});

/* ===============================
   Reveal Elements on Scroll
================================ */
const revealElements = document.querySelectorAll(".reveal");

const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("active");
      }
    });
  },
  {
    threshold: 0.15,
  },
);

revealElements.forEach((el) => revealObserver.observe(el));

/* ===============================
   Animated Counters
================================ */
const counters = document.querySelectorAll(".counter");

function runCounter(counter) {
  const target = +counter.dataset.target;
  let count = 0;
  const speed = target / 100;

  const update = () => {
    if (count < target) {
      count += speed;
      counter.innerText = Math.ceil(count);
      requestAnimationFrame(update);
    } else {
      counter.innerText = target;
    }
  };

  update();
}

const counterObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        runCounter(entry.target);
        counterObserver.unobserve(entry.target);
      }
    });
  },
  {
    threshold: 0.6,
  },
);

counters.forEach((counter) => counterObserver.observe(counter));

/* ===============================
   Copy Server IP to Clipboard
================================ */

const ipElements = document.querySelectorAll(".server-ip, .footer-ip, .cta-ip");

function copyText(text) {
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text);
  }

  // fallback for http / local
  return new Promise((resolve) => {
    const textarea = document.createElement("textarea");
    textarea.value = text;

    textarea.style.position = "fixed";
    textarea.style.opacity = "0";

    document.body.appendChild(textarea);

    textarea.focus();
    textarea.select();

    document.execCommand("copy");

    textarea.remove();

    resolve();
  });
}

ipElements.forEach((el) => {
  el.addEventListener("click", (e) => {
    const ip = "connect sv.nox-rp.ir";

    const rect = el.getBoundingClientRect();

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    el.style.setProperty("--ripple-x", x + "px");
    el.style.setProperty("--ripple-y", y + "px");

    copyText(ip).then(() => {
      el.classList.add("copy-success");
      el.classList.add("copy-animate");
      el.classList.add("copy-ripple");

      showToast("IP سرور کپی شد");

      setTimeout(() => {
        el.classList.remove("copy-success");
        el.classList.remove("copy-animate");
        el.classList.remove("copy-ripple");
      }, 1500);
    });
  });
});

/* ===============================
   Toast Notification
================================ */

function showToast(message, type = "success") {
  const container = document.getElementById("toast-container");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = "toast " + type;

  toast.innerHTML = `
    <div class="toast-icon">✅</div>
    <div class="toast-text">${message}</div>
    <div class="toast-close">✕</div>
  `;

  container.appendChild(toast);

  const duration = 3000;
  let remaining = duration;
  let timer;
  let startTime;

  function startTimer() {
    startTime = Date.now();

    timer = setTimeout(() => {
      hideToast();
    }, remaining);
  }

  function pauseTimer() {
    clearTimeout(timer);
    remaining -= Date.now() - startTime;
  }

  function resumeTimer() {
    startTimer();
  }

  function hideToast() {
    toast.classList.add("hide");

    setTimeout(() => {
      toast.remove();
    }, 350);
  }

  startTimer();

  toast.addEventListener("mouseenter", pauseTimer);
  toast.addEventListener("mouseleave", resumeTimer);

  toast.querySelector(".toast-close").onclick = hideToast;
}

const rules = document.querySelectorAll(".rule-card");

rules.forEach((rule) => {
  const header = rule.querySelector(".rule-header");
  const body = rule.querySelector(".rule-body");

  header.addEventListener("click", () => {
    body.style.display = body.style.display === "block" ? "none" : "block";
  });
});

const search = document.getElementById("rulesSearch");

if (search) {
  search.addEventListener("input", function () {
    const value = this.value.toLowerCase();

    rules.forEach((rule) => {
      const text = rule.innerText.toLowerCase();

      rule.style.display = text.includes(value) ? "block" : "none";
    });
  });
}

/* ===============================
   FAQ Accordion
================================ */

document.querySelectorAll(".faq-question").forEach((q) => {
  q.addEventListener("click", () => {
    const item = q.parentElement;

    item.classList.toggle("active");
  });
});

/* ===============================
   FAQ Live Search
================================ */

const searchInput = document.getElementById("faqSearch");

if (searchInput) {
  searchInput.addEventListener("input", () => {
    const value = searchInput.value.toLowerCase();

    document.querySelectorAll(".faq-item").forEach((item) => {
      const text = item.innerText.toLowerCase();

      item.style.display = text.includes(value) ? "block" : "none";
    });
  });
}

console.log("script loaded");

/* ===============================
   Copy Contact TS/IP
================================ */

const copyTargets = document.querySelectorAll(".contact-ip, .contact-ts");

copyTargets.forEach((el) => {
  el.addEventListener("click", (e) => {
    e.stopPropagation();

    const value = el.innerText.trim();

    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    el.style.setProperty("--ripple-x", x + "px");
    el.style.setProperty("--ripple-y", y + "px");

    copyText(value).then(() => {
      el.classList.add("copy-success");
      el.classList.add("copy-animate");
      el.classList.add("copy-ripple");

      showToast("کپی شد: " + value);

      setTimeout(() => {
        el.classList.remove("copy-success", "copy-animate", "copy-ripple");
      }, 1500);
    });
  });
});

/* ===============================
   TeamSpeak Live Status (FINAL)
================================ */

const TS_API_URL = "https://api.tsstatus.net/ts3.php?address=ts.nox-rp.ir";

const TS_REFRESH_INTERVAL = 15000;
const TS_TIMEOUT = 7000;

function setOfflineState() {
  const dot = document.getElementById("ts-dot");
  const text = document.getElementById("ts-text");
  const users = document.getElementById("ts-users-count");

  if (!dot || !text || !users) return;

  dot.className = "ts-dot offline";
  text.innerText = "آفلاین";
  users.innerText = "0";
}

function setOnlineState(data) {
  const dot = document.getElementById("ts-dot");
  const text = document.getElementById("ts-text");
  const users = document.getElementById("ts-users-count");

  if (!dot || !text || !users) return;

  dot.className = "ts-dot online";
  text.innerText = "آنلاین";
  users.innerText = data.virtualserver_clientsonline ?? "0";
}

async function fetchTSStatus() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TS_TIMEOUT);

  try {
    const res = await fetch(TS_API_URL, {
      method: "GET",
      signal: controller.signal,
      headers: {
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      throw new Error("TS API response not OK");
    }

    const data = await res.json();

    if (!data || data.status !== "online") {
      setOfflineState();
      return;
    }

    setOnlineState(data);
  } catch (err) {
    console.error("TeamSpeak Status Error:", err);
    setOfflineState();
  } finally {
    clearTimeout(timeout);
  }
}

fetchTSStatus();

setInterval(fetchTSStatus, TS_REFRESH_INTERVAL);
