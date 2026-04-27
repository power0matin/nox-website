/* ==========================================================
   NOX Roleplay Main Scripts — stable, accessible, defensive
   ========================================================== */

(() => {
  "use strict";

  const SERVER_CONNECT = "connect sv.nox-rp.ir";
  const TOAST_DURATION = 3200;

  const qs = (selector, scope = document) => scope.querySelector(selector);
  const qsa = (selector, scope = document) =>
    Array.from(scope.querySelectorAll(selector));

  const toastIcons = {
    success: `
      <svg class="toast-svg" viewBox="0 0 24 24" fill="none" focusable="false">
        <path d="M20 6 9 17l-5-5" />
      </svg>
    `,
    error: `
      <svg class="toast-svg" viewBox="0 0 24 24" fill="none" focusable="false">
        <path d="M12 8v5" />
        <path d="M12 17h.01" />
        <path d="M10.3 4.4 2.8 17.4A2 2 0 0 0 4.5 20h15a2 2 0 0 0 1.7-2.6L13.7 4.4a2 2 0 0 0-3.4 0Z" />
      </svg>
    `,
    info: `
      <svg class="toast-svg" viewBox="0 0 24 24" fill="none" focusable="false">
        <path d="M12 17v-6" />
        <path d="M12 7h.01" />
        <path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
      </svg>
    `,
  };

  function onReady(callback) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", callback, { once: true });
      return;
    }

    callback();
  }

  function setText(el, value) {
    if (el) el.textContent = String(value ?? "");
  }

  function isInteractiveElement(el) {
    return el.matches("button, a, input, textarea, select, summary, [role]");
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
      /* fallback below */
    }

    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.top = "0";
    textarea.style.left = "0";
    textarea.style.width = "1px";
    textarea.style.height = "1px";
    textarea.style.opacity = "0";
    textarea.style.pointerEvents = "none";

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

    const safeType = ["success", "error", "info"].includes(type)
      ? type
      : "info";

    const toast = document.createElement("div");
    toast.className = `toast ${safeType}`;
    toast.setAttribute("role", safeType === "error" ? "alert" : "status");
    toast.setAttribute(
      "aria-live",
      safeType === "error" ? "assertive" : "polite",
    );

    toast.innerHTML = `
      <div class="toast-icon" aria-hidden="true">${toastIcons[safeType]}</div>
      <div class="toast-text"></div>
      <button class="toast-close" type="button" aria-label="بستن پیام">×</button>
    `;

    setText(qs(".toast-text", toast), message);
    container.appendChild(toast);

    let timer = window.setTimeout(hideToast, TOAST_DURATION);

    function hideToast() {
      window.clearTimeout(timer);
      toast.classList.add("hide");

      window.setTimeout(() => {
        toast.remove();
      }, 360);
    }

    toast.addEventListener("mouseenter", () => {
      window.clearTimeout(timer);
    });

    toast.addEventListener("mouseleave", () => {
      timer = window.setTimeout(hideToast, 1200);
    });

    qs(".toast-close", toast)?.addEventListener("click", hideToast);
  }

  function applyCopyFeedback(el, event) {
    const rect = el.getBoundingClientRect();

    const point =
      event && typeof event.clientX === "number"
        ? {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top,
          }
        : {
            x: rect.width / 2,
            y: rect.height / 2,
          };

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
        const href = anchor.getAttribute("href");

        if (!href || href === "#") return;

        let target = null;

        try {
          const id = decodeURIComponent(href.slice(1));
          target = document.getElementById(id);
        } catch (_) {
          target = null;
        }

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
          if (!entry.isIntersecting) return;

          entry.target.classList.add("active");
          observer.unobserve(entry.target);
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
      if (counter.dataset.counted === "true") return;

      counter.dataset.counted = "true";

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
          if (!entry.isIntersecting) return;

          runCounter(entry.target);
          observer.unobserve(entry.target);
        });
      },
      {
        threshold: 0.55,
      },
    );

    counters.forEach((counter) => observer.observe(counter));
  }

  function initCopyBlocks() {
    const selectors =
      ".server-ip, .footer-ip, .cta-ip, .contact-ip, .contact-ts, .step-ip";

    qsa(selectors).forEach((el) => {
      if (!isInteractiveElement(el)) {
        el.setAttribute("tabindex", "0");
        el.setAttribute("role", "button");
      }

      if (!el.hasAttribute("aria-label")) {
        el.setAttribute("aria-label", "کپی مقدار");
      }

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
          showToast(`کپی شد: ${value}`, "success");
          return;
        }

        showToast("کپی خودکار انجام نشد. لطفا متن را دستی کپی کنید.", "error");
      }

      el.addEventListener("click", handleCopy);

      el.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;

        event.preventDefault();
        handleCopy(event);
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
        if (event.key !== "Enter" && event.key !== " ") return;

        event.preventDefault();
        toggle();
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

    const scope =
      search.closest("section") || search.closest("main") || document;
    const ruleCards = qsa(".rule-card, .rules .card", scope);

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
