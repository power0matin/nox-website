/* ==========================================================
   NOX Roleplay Main Scripts — stable, accessible, defensive
   ========================================================== */

(() => {
  "use strict";

  const SERVER_CONNECT = "connect sv.nox-rp.ir";
  const TOAST_DURATION = 3200;

  const qs = (selector, scope = document) => scope.querySelector(selector);
  const qsa = (selector, scope = document) => [
    ...scope.querySelectorAll(selector),
  ];

  function onReady(callback) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", callback, { once: true });
    } else {
      callback();
    }
  }

  function setText(el, value) {
    if (el) el.textContent = value;
  }

  async function copyText(text) {
    const value = String(text || "").trim();
    if (!value) return false;

    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(value);
        return true;
      }
    } catch (_) {
      // Fallback below.
    }

    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.inset = "0 auto auto 0";
    textarea.style.width = "1px";
    textarea.style.height = "1px";
    textarea.style.opacity = "0";

    document.body.appendChild(textarea);
    textarea.focus({ preventScroll: true });
    textarea.select();

    let copied = false;
    try {
      copied = document.execCommand("copy");
    } catch (_) {
      copied = false;
    }

    textarea.remove();
    return copied;
  }

  function showToast(message, type = "success") {
    const container = qs("#toast-container");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.setAttribute("role", "status");

    const icon = type === "success" ? "✅" : type === "error" ? "⚠️" : "ℹ️";
    toast.innerHTML = `
      <div class="toast-icon" aria-hidden="true">${icon}</div>
      <div class="toast-text"></div>
      <button class="toast-close" type="button" aria-label="بستن پیام">×</button>
    `;

    setText(qs(".toast-text", toast), message);
    container.appendChild(toast);

    let timer = window.setTimeout(hideToast, TOAST_DURATION);

    function hideToast() {
      window.clearTimeout(timer);
      toast.classList.add("hide");
      window.setTimeout(() => toast.remove(), 360);
    }

    toast.addEventListener("mouseenter", () => window.clearTimeout(timer));
    toast.addEventListener("mouseleave", () => {
      timer = window.setTimeout(hideToast, 1200);
    });

    qs(".toast-close", toast)?.addEventListener("click", hideToast);
  }

  function applyCopyFeedback(el, event) {
    const rect = el.getBoundingClientRect();
    const point =
      event && "clientX" in event
        ? { x: event.clientX - rect.left, y: event.clientY - rect.top }
        : { x: rect.width / 2, y: rect.height / 2 };

    el.style.setProperty("--ripple-x", `${point.x}px`);
    el.style.setProperty("--ripple-y", `${point.y}px`);

    el.classList.remove("copy-success", "copy-animate", "copy-ripple");
    void el.offsetWidth;
    el.classList.add("copy-success", "copy-animate", "copy-ripple");

    window.setTimeout(() => {
      el.classList.remove("copy-success", "copy-animate", "copy-ripple");
    }, 1500);
  }

  function initMobileNavigation() {
    const hamburger = qs("#hamburger");
    const navLinks = qs("#navLinks");
    const overlay = qs("#mobileOverlay");

    if (!hamburger || !navLinks || !overlay) return;

    const focusableSelector =
      'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

    function openMenu() {
      hamburger.classList.add("active");
      hamburger.setAttribute("aria-expanded", "true");

      navLinks.classList.add("open");

      overlay.hidden = false;
      overlay.classList.add("show");

      document.body.classList.add("menu-open");

      qs(focusableSelector, navLinks)?.focus({ preventScroll: true });
    }

    function closeMenu() {
      hamburger.classList.remove("active");
      hamburger.setAttribute("aria-expanded", "false");

      navLinks.classList.remove("open");

      overlay.classList.remove("show");
      document.body.classList.remove("menu-open");

      window.setTimeout(() => {
        if (!navLinks.classList.contains("open")) {
          overlay.hidden = true;
        }
      }, 250);
    }

    hamburger.addEventListener("click", () => {
      navLinks.classList.contains("open") ? closeMenu() : openMenu();
    });

    overlay.addEventListener("click", closeMenu);

    qsa("a", navLinks).forEach((link) => {
      link.addEventListener("click", closeMenu);
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && navLinks.classList.contains("open")) {
        closeMenu();
        hamburger.focus({ preventScroll: true });
      }
    });
  }

  function initSmoothAnchors() {
    qsa('a[href^="#"]').forEach((anchor) => {
      anchor.addEventListener("click", (event) => {
        const targetId = anchor.getAttribute("href");
        if (!targetId || targetId === "#") return;

        const target = qs(targetId);
        if (!target) return;

        event.preventDefault();

        target.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      });
    });
  }

  function initReveal() {
    const elements = qsa(".reveal");
    if (!elements.length) return;

    if (!("IntersectionObserver" in window)) {
      elements.forEach((el) => el.classList.add("active"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("active");
            observer.unobserve(entry.target);
          }
        });
      },
      {
        threshold: 0.14,
        rootMargin: "0px 0px -40px 0px",
      },
    );

    elements.forEach((el) => observer.observe(el));
  }

  function initCounters() {
    const counters = qsa(".counter");
    if (!counters.length) return;

    function runCounter(counter) {
      const target = Number(counter.dataset.target || 0);

      if (!Number.isFinite(target) || target <= 0) {
        counter.textContent = "0";
        return;
      }

      const duration = 1200;
      const start = performance.now();

      function frame(now) {
        const progress = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);

        counter.textContent = String(Math.round(target * eased));

        if (progress < 1) {
          requestAnimationFrame(frame);
        }
      }

      requestAnimationFrame(frame);
    }

    if (!("IntersectionObserver" in window)) {
      counters.forEach(runCounter);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            runCounter(entry.target);
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.55 },
    );

    counters.forEach((counter) => observer.observe(counter));
  }

  function initCopyBlocks() {
    const selectors =
      ".server-ip, .footer-ip, .cta-ip, .contact-ip, .contact-ts, .step-ip";

    qsa(selectors).forEach((el) => {
      if (!el.hasAttribute("tabindex")) el.setAttribute("tabindex", "0");
      if (!el.hasAttribute("role")) el.setAttribute("role", "button");
      if (!el.hasAttribute("aria-label"))
        el.setAttribute("aria-label", "کپی مقدار");

      async function handleCopy(event) {
        event.preventDefault();

        const isServerCopy =
          el.classList.contains("server-ip") ||
          el.classList.contains("footer-ip") ||
          el.classList.contains("cta-ip") ||
          el.classList.contains("step-ip");

        const value =
          el.dataset.copy ||
          (isServerCopy ? SERVER_CONNECT : el.textContent.trim());

        const ok = await copyText(value);

        if (ok) {
          applyCopyFeedback(el, event);
          showToast(`کپی شد: ${value}`);
        } else {
          showToast(
            "کپی خودکار انجام نشد. لطفا متن را دستی کپی کنید.",
            "error",
          );
        }
      }

      el.addEventListener("click", handleCopy);

      el.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          handleCopy(event);
        }
      });
    });
  }

  function initFaq() {
    qsa(".faq-question").forEach((question) => {
      const item = question.closest(".faq-item");
      if (!item) return;

      question.setAttribute("role", "button");
      question.setAttribute("tabindex", "0");
      question.setAttribute(
        "aria-expanded",
        item.classList.contains("active") ? "true" : "false",
      );

      function toggle() {
        const isOpen = item.classList.toggle("active");
        question.setAttribute("aria-expanded", isOpen ? "true" : "false");
      }

      question.addEventListener("click", toggle);

      question.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          toggle();
        }
      });
    });

    const search = qs("#faqSearch");
    if (!search) return;

    search.addEventListener("input", () => {
      const value = search.value.trim().toLocaleLowerCase("fa-IR");

      qsa(".faq-item").forEach((item) => {
        const text = item.textContent.toLocaleLowerCase("fa-IR");
        item.hidden = value.length > 0 && !text.includes(value);
      });
    });
  }

  function initRulesSearch() {
    const search = qs("#rulesSearch");
    if (!search) return;

    const ruleCards = qsa(".card, .rule-card").filter((card) => {
      return card.closest(".rules") || card.closest("main");
    });

    search.addEventListener("input", () => {
      const value = search.value.trim().toLocaleLowerCase("fa-IR");

      ruleCards.forEach((card) => {
        const text = card.textContent.toLocaleLowerCase("fa-IR");
        card.hidden = value.length > 0 && !text.includes(value);
      });
    });
  }

  onReady(() => {
    initMobileNavigation();
    initSmoothAnchors();
    initReveal();
    initCounters();
    initCopyBlocks();
    initFaq();
    initRulesSearch();
  });
})();
