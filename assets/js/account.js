/* ==========================================================
   NOX Roleplay Account + Subscription Layer
   Optimized frontend mock implementation.
   Replace apiAdapter methods with real backend/payment calls in production.
   ========================================================== */

(() => {
  "use strict";

  const API_BASE_URL = window.NOX_API_BASE_URL || "/api";

  const TOAST_DURATION = 3200;
  const AUTH_CLOSE_DELAY = 280;
  const AUTH_LEAVE_DELAY = 180;
  const AUTH_ENTER_DELAY = 280;

  let accountState = {
    user: null,
    subscription: null,
    ready: false,
  };

  const qs = (selector, scope = document) => scope.querySelector(selector);
  const qsa = (selector, scope = document) =>
    Array.from(scope.querySelectorAll(selector));

  const inPages = /\/pages\//.test(window.location.pathname);
  const pagePrefix = inPages ? "" : "pages/";

  const routes = {
    home: inPages ? "../index.html" : "index.html",
    profile: `${pagePrefix}profile.html`,
    settings: `${pagePrefix}account-settings.html`,
    subscription: `${pagePrefix}subscription.html`,
    dashboard: `${pagePrefix}dashboard.html`,
  };

  const plans = {
    basic: {
      label: "رایگان",
      price: "۰ تومان",
      priority: "اولویت معمولی",
    },
    priority: {
      label: "Priority",
      price: "۱۴۹ هزار تومان",
      priority: "اولویت بالاتر در صف",
    },
    elite: {
      label: "Elite",
      price: "۲۹۹ هزار تومان",
      priority: "بالاترین اولویت صف",
    },
  };

  let lastFocused = null;
  let authSwitchTimer = null;
  let authEnterTimer = null;
  let authCloseTimer = null;
  let accountGlobalListenersReady = false;

  const apiAdapter = {
    async login(email, password) {
      const data = await request("/auth/login", {
        method: "POST",
        body: {
          email: normalizeEmail(email),
          password,
        },
      });

      setAccountState(data);
      return data.user;
    },

    async signup(payload) {
      const data = await request("/auth/signup", {
        method: "POST",
        body: {
          name: String(payload.name || "").trim(),
          email: normalizeEmail(payload.email),
          password: payload.password,
        },
      });

      setAccountState(data);
      return data.user;
    },

    async updateProfile(payload) {
      const data = await request("/me", {
        method: "PATCH",
        body: {
          name: String(payload.name || "").trim(),
          email: normalizeEmail(payload.email),
        },
      });

      setAccountState(data);
      return data.user;
    },

    async getMe() {
      return request("/me");
    },

    async getSubscription() {
      const data = await request("/subscription");

      accountState.subscription = data.subscription || null;
      accountState.ready = true;

      return accountState.subscription;
    },

    async subscribe(planKey) {
      const plan = plans[planKey];

      if (!plan) {
        throw new Error("پلن انتخابی معتبر نیست.");
      }

      const data = await request("/subscription/checkout", {
        method: "POST",
        body: {
          plan: planKey,
        },
      });

      /*
      For paid plans, backend should return:
      { checkoutUrl: "https://payment-gateway..." }

      For free/basic plan, backend may return:
      { subscription: {...} }
    */

      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
        return null;
      }

      if (data.subscription) {
        accountState.subscription = data.subscription;
        return data.subscription;
      }

      await loadAccountState();
      return getCurrentSubscription();
    },

    async logout() {
      try {
        await request("/auth/logout", {
          method: "POST",
        });
      } finally {
        clearAccountState();
      }
    },
  };

  function csrfHeaders() {
    const token = getCookie("csrf_token");

    return token
      ? {
          "X-CSRF-Token": token,
        }
      : {};
  }

  function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);

    if (parts.length !== 2) return "";

    return parts.pop().split(";").shift() || "";
  }

  async function request(path, options = {}) {
    const hasBody = Object.prototype.hasOwnProperty.call(options, "body");

    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method || "GET",
      credentials: "include",
      headers: {
        Accept: "application/json",
        ...(hasBody ? { "Content-Type": "application/json" } : {}),
        ...csrfHeaders(),
        ...(options.headers || {}),
      },
      body: hasBody ? JSON.stringify(options.body) : undefined,
    });

    if (response.status === 204) {
      return null;
    }

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        data?.message ||
          data?.detail ||
          "درخواست ناموفق بود. لطفاً دوباره تلاش کنید.",
      );
    }

    return data;
  }

  function setAccountState(data) {
    accountState.user = data?.user || null;
    accountState.subscription = data?.subscription || null;
    accountState.ready = true;

    return accountState;
  }

  function clearAccountState() {
    accountState.user = null;
    accountState.subscription = null;
    accountState.ready = true;
  }

  async function loadAccountState() {
    try {
      const data = await apiAdapter.getMe();
      setAccountState(data);
    } catch (_) {
      clearAccountState();
    }

    renderAccountNav();
    hydrateAccountPages();
  }

  function getCurrentUser() {
    return accountState.user;
  }

  function getCurrentSubscription() {
    return accountState.subscription;
  }
  function normalizeEmail(value) {
    return String(value || "")
      .trim()
      .toLowerCase();
  }
  function initials(name, email) {
    const source = String(name || email || "N").trim();
    const parts = source.split(/\s+/).filter(Boolean);

    if (parts.length > 1) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }

    return source.slice(0, 2).toUpperCase();
  }

  function escapeHtml(value) {
    return String(value || "").replace(/[&<>'"]/g, (char) => {
      const map = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&#39;",
        '"': "&quot;",
      };

      return map[char];
    });
  }

  function iconSvg(type = "success") {
    if (type === "error") {
      return `
        <svg class="toast-svg" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 8.25v4.35"></path>
          <path d="M12 16.25h.01"></path>
          <path d="M10.15 4.5 2.9 17.1c-.72 1.25.18 2.8 1.63 2.8h14.94c1.45 0 2.35-1.55 1.63-2.8L13.85 4.5c-.72-1.25-2.98-1.25-3.7 0Z"></path>
        </svg>
      `;
    }

    if (type === "info") {
      return `
        <svg class="toast-svg" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z"></path>
          <path d="M12 10.75v5"></path>
          <path d="M12 7.75h.01"></path>
        </svg>
      `;
    }

    return `
      <svg class="toast-svg" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M20 6.75 9.25 17.5 4 12.25"></path>
      </svg>
    `;
  }

  function toast(message, type = "success") {
    const container = qs("#toast-container");
    if (!container) return;

    const el = document.createElement("div");
    el.className = `toast ${type}`;
    el.setAttribute("role", type === "error" ? "alert" : "status");

    el.innerHTML = `
      <div class="toast-icon" aria-hidden="true">${iconSvg(type)}</div>
      <div class="toast-text"></div>
      <button class="toast-close" type="button" aria-label="بستن پیام">×</button>
    `;

    qs(".toast-text", el).textContent = message;
    container.appendChild(el);

    const close = () => {
      el.classList.add("hide");
      window.setTimeout(() => el.remove(), 360);
    };

    const timer = window.setTimeout(close, TOAST_DURATION);

    qs(".toast-close", el)?.addEventListener("click", () => {
      window.clearTimeout(timer);
      close();
    });
  }

  function accountIconMarkup() {
    return `
      <svg class="account-entry-svg" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 12.25c2.42 0 4.38-1.96 4.38-4.38S14.42 3.5 12 3.5 7.62 5.46 7.62 7.87s1.96 4.38 4.38 4.38Z"></path>
        <path d="M4.75 20.5c.72-3.48 3.55-5.75 7.25-5.75s6.53 2.27 7.25 5.75"></path>
      </svg>
    `;
  }

  function createAccountNav() {
    const navContainer = qs(".nav-container");
    const hamburger = qs("#hamburger");

    if (!navContainer || qs("#accountNav")) return;

    const wrapper = document.createElement("div");
    wrapper.id = "accountNav";
    wrapper.className = "account-nav";

    if (hamburger) {
      navContainer.insertBefore(wrapper, hamburger);
    } else {
      navContainer.appendChild(wrapper);
    }

    initAccountGlobalListeners();
    renderAccountNav();
  }

  function renderAccountNav() {
    const wrapper = qs("#accountNav");
    if (!wrapper) return;

    const user = getCurrentUser();

    if (!user) {
      wrapper.innerHTML = `
        <button class="account-entry" type="button" data-open-auth="login" aria-haspopup="dialog" aria-label="ورود به حساب کاربری">
          <span class="account-entry-icon" aria-hidden="true">
            ${accountIconMarkup()}
          </span>
          <span class="account-entry-text">حساب کاربری</span>
        </button>
      `;

      qs("[data-open-auth]", wrapper)?.addEventListener("click", () => {
        openAuthModal("login");
      });

      return;
    }

    const sub = getCurrentSubscription();
    const planKey = sub?.plan || "basic";
    const plan = plans[planKey] || plans.basic;

    wrapper.innerHTML = `
      <div class="user-menu" data-user-menu>
        <button class="user-trigger" type="button" aria-haspopup="menu" aria-expanded="false">
          <span class="user-avatar" aria-hidden="true">${initials(user.name, user.email)}</span>
          <span class="user-trigger-name">${escapeHtml(user.name)}</span>
          <span class="user-trigger-caret" aria-hidden="true">⌄</span>
        </button>

        <div class="user-dropdown" role="menu" aria-label="منوی حساب کاربری">
          <div class="user-dropdown-head">
            <span class="user-avatar large" aria-hidden="true">${initials(user.name, user.email)}</span>
            <div>
              <strong>${escapeHtml(user.name)}</strong>
              <small>${escapeHtml(user.email)}</small>
            </div>
          </div>

          <div class="subscription-pill ${planKey === "basic" ? "" : "active"}">
            ${escapeHtml(plan.label)} · ${escapeHtml(plan.priority)}
          </div>

        <a role="menuitem" href="${routes.dashboard}">داشبورد</a>
        <a role="menuitem" href="${routes.profile}">پروفایل</a>
        <a role="menuitem" href="${routes.settings}">تنظیمات حساب</a>
        <a role="menuitem" href="${routes.subscription}">اشتراک / پرداخت</a>
        ${user.isAdmin ? `<a role="menuitem" href="${pagePrefix}admin.html">پنل ادمین</a>` : ""}
        <button role="menuitem" type="button" data-logout>خروج</button>
        </div>
      </div>
    `;

    const trigger = qs(".user-trigger", wrapper);
    const menu = qs("[data-user-menu]", wrapper);
    const dropdown = qs(".user-dropdown", wrapper);

    trigger?.addEventListener("click", (event) => {
      event.stopPropagation();
      toggleUserMenu(menu, trigger);
    });

    trigger?.addEventListener("keydown", (event) => {
      if (event.key !== "ArrowDown") return;

      event.preventDefault();
      openUserMenu(menu, trigger);
      qs("a, button:not(.user-trigger)", dropdown)?.focus({
        preventScroll: true,
      });
    });

    qs("[data-logout]", wrapper)?.addEventListener("click", handleLogout);
  }

  function initAccountGlobalListeners() {
    if (accountGlobalListenersReady) return;
    accountGlobalListenersReady = true;

    document.addEventListener("click", (event) => {
      const wrapper = qs("#accountNav");
      const menu = qs("[data-user-menu]");
      const trigger = qs(".user-trigger");

      if (!wrapper || !menu || !trigger) return;
      if (!wrapper.contains(event.target)) closeUserMenu(menu, trigger);
    });

    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;

      const menu = qs("[data-user-menu]");
      const trigger = qs(".user-trigger");

      closeUserMenu(menu, trigger);
    });
  }

  function openUserMenu(menu, trigger) {
    menu?.classList.add("open");
    trigger?.setAttribute("aria-expanded", "true");
  }

  function closeUserMenu(menu, trigger) {
    menu?.classList.remove("open");
    trigger?.setAttribute("aria-expanded", "false");
  }

  function toggleUserMenu(menu, trigger) {
    if (!menu || !trigger) return;

    const isOpen = menu.classList.toggle("open");
    trigger.setAttribute("aria-expanded", isOpen ? "true" : "false");
  }

  async function handleLogout() {
    try {
      await apiAdapter.logout();

      toast("از حساب کاربری خارج شدید.");

      if (document.body.dataset.protected === "true") {
        window.location.href = routes.home;
        return;
      }

      renderAccountNav();
      hydrateAccountPages();
    } catch (error) {
      toast(error.message, "error");
    }
  }

  function createAuthModal() {
    if (qs("#authModal")) return;

    const modal = document.createElement("div");

    modal.id = "authModal";
    modal.className = "auth-modal";
    modal.hidden = true;

    modal.innerHTML = `
  <div class="auth-backdrop" data-close-auth></div>

  <section class="auth-panel" role="dialog" aria-modal="true" aria-labelledby="authTitle" tabindex="-1">
    <button class="auth-close" type="button" data-close-auth aria-label="بستن پنجره">×</button>

    <div class="auth-content">
      <div class="auth-tabs" role="tablist" aria-label="ورود یا ثبت نام">
        <button id="loginTab" class="active" type="button" role="tab" aria-selected="true" data-auth-tab="login">
          ورود
        </button>
        <button id="signupTab" type="button" role="tab" aria-selected="false" data-auth-tab="signup">
          ثبت نام
        </button>
      </div>

      <h2 id="authTitle">ورود به حساب</h2>
      <p class="auth-subtitle">برای مدیریت پروفایل و اشتراک وارد شوید.</p>

      <form class="auth-form active" id="loginForm" novalidate data-auth-form="login">
        <div class="form-field">
          <label for="loginEmail">ایمیل</label>
          <input id="loginEmail" name="email" type="email" autocomplete="email" placeholder="you@example.com" required>
          <small class="field-error" data-error-for="loginEmail"></small>
        </div>

        <div class="form-field">
          <label for="loginPassword">رمز عبور</label>
          <input id="loginPassword" name="password" type="password" autocomplete="current-password" minlength="8" required>
          <small class="field-error" data-error-for="loginPassword"></small>
        </div>

        <button class="btn primary auth-submit" type="submit">
          <span>ورود به حساب</span>
        </button>

        <p class="auth-switch">
          حساب ندارید؟
          <button type="button" data-auth-tab="signup">ثبت نام کنید</button>
        </p>
      </form>

      <form class="auth-form" id="signupForm" novalidate data-auth-form="signup">
        <div class="form-field">
          <label for="signupName">نام نمایشی</label>
          <input id="signupName" name="name" type="text" autocomplete="name" minlength="2" placeholder="مثلاً Matin" required>
          <small class="field-error" data-error-for="signupName"></small>
        </div>

        <div class="form-field">
          <label for="signupEmail">ایمیل</label>
          <input id="signupEmail" name="email" type="email" autocomplete="email" placeholder="you@example.com" required>
          <small class="field-error" data-error-for="signupEmail"></small>
        </div>

        <div class="form-field">
          <label for="signupPassword">رمز عبور</label>
          <input id="signupPassword" name="password" type="password" autocomplete="new-password" minlength="8" required>
          <small class="field-error" data-error-for="signupPassword"></small>
        </div>

        <div class="form-field checkbox-field">
          <label>
            <input id="signupTerms" name="terms" type="checkbox" required>
            قوانین سرور و شرایط حساب را می‌پذیرم.
          </label>
          <small class="field-error" data-error-for="signupTerms"></small>
        </div>

        <button class="btn primary auth-submit" type="submit">
          <span>ساخت حساب</span>
        </button>

        <p class="auth-switch">
          حساب دارید؟
          <button type="button" data-auth-tab="login">وارد شوید</button>
        </p>
      </form>
    </div>

    <div class="auth-visual" aria-hidden="true">
      <span class="auth-badge">NOX Account</span>
      <h2 id="authVisualTitle">ورود سریع‌تر، صف بهتر، تجربه حرفه‌ای‌تر</h2>
      <p id="authVisualText">حساب کاربری NOX مسیر ورود، پروفایل و اشتراک اولویت صف را یکپارچه می‌کند.</p>
    </div>
  </section>
`;
    document.body.appendChild(modal);

    qsa("[data-close-auth]", modal).forEach((element) => {
      element.addEventListener("click", closeAuthModal);
    });

    qsa("[data-auth-tab]", modal).forEach((element) => {
      element.addEventListener("click", () =>
        switchAuthTab(element.dataset.authTab),
      );
    });

    qs("#loginForm", modal)?.addEventListener("submit", handleLogin);
    qs("#signupForm", modal)?.addEventListener("submit", handleSignup);

    modal.addEventListener("keydown", trapModalFocus);
  }

  function resetAuthScroll(modal) {
    const panel = qs(".auth-panel", modal);
    const content = qs(".auth-content", modal);

    if (panel) panel.scrollTop = 0;
    if (content) content.scrollTop = 0;
  }

  function openAuthModal(mode = "login") {
    createAuthModal();

    const modal = qs("#authModal");
    if (!modal) return;

    window.clearTimeout(authCloseTimer);
    window.clearTimeout(authSwitchTimer);
    window.clearTimeout(authEnterTimer);

    lastFocused = document.activeElement;

    modal.hidden = false;
    document.body.classList.add("auth-open");

    modal.dataset.authMode = "";
    switchAuthTab(mode, { animate: false });

    window.setTimeout(() => {
      modal.classList.add("show");

      const panel = qs(".auth-panel", modal);
      panel?.focus({ preventScroll: true });

      resetAuthScroll(modal);
    }, 20);
  }

  function closeAuthModal() {
    const modal = qs("#authModal");
    if (!modal) return;

    modal.classList.remove("show");
    document.body.classList.remove("auth-open");

    window.clearTimeout(authCloseTimer);

    authCloseTimer = window.setTimeout(() => {
      modal.hidden = true;
      resetAuthScroll(modal);
      lastFocused?.focus?.({ preventScroll: true });
    }, AUTH_CLOSE_DELAY);
  }

  function switchAuthTab(mode = "login", options = {}) {
    const modal = qs("#authModal");
    if (!modal) return;

    const { animate = true } = options;

    const nextMode = mode === "signup" ? "signup" : "login";
    const isLogin = nextMode === "login";

    const currentForm = qs(".auth-form.active", modal);
    const nextForm = qs(`[data-auth-form="${nextMode}"]`, modal);

    if (
      modal.dataset.authMode === nextMode &&
      nextForm?.classList.contains("active")
    ) {
      resetAuthScroll(modal);
      return;
    }

    window.clearTimeout(authSwitchTimer);
    window.clearTimeout(authEnterTimer);

    modal.dataset.authMode = nextMode;

    qsa(".auth-tabs [data-auth-tab]", modal).forEach((tab) => {
      const active = tab.dataset.authTab === nextMode;

      tab.classList.toggle("active", active);
      tab.setAttribute("aria-selected", active ? "true" : "false");
    });

    const title = qs("#authTitle", modal);
    const subtitle = qs(".auth-subtitle", modal);
    const visualTitle = qs("#authVisualTitle", modal);
    const visualText = qs("#authVisualText", modal);

    if (title) {
      title.textContent = isLogin ? "ورود به حساب" : "ساخت حساب NOX";
    }

    if (subtitle) {
      subtitle.textContent = isLogin
        ? "برای مدیریت پروفایل و اشتراک وارد شوید."
        : "حساب خود را بسازید و امکانات کاربری را فعال کنید.";
    }

    if (visualTitle) {
      visualTitle.textContent = isLogin
        ? "ورود سریع‌تر، صف بهتر، تجربه حرفه‌ای‌تر"
        : "حساب بسازید و آماده ورود شوید";
    }

    if (visualText) {
      visualText.textContent = isLogin
        ? "حساب کاربری NOX مسیر ورود، پروفایل و اشتراک اولویت صف را یکپارچه می‌کند."
        : "با ساخت حساب، مدیریت پروفایل، تنظیمات و اشتراک شما در یک مسیر تمیز و سریع قرار می‌گیرد.";
    }

    clearFormErrors(modal);

    if (!nextForm) return;

    if (!animate || !currentForm || currentForm === nextForm) {
      qsa(".auth-form", modal).forEach((form) => {
        form.classList.toggle("active", form === nextForm);
        form.classList.remove("leaving", "entering");
      });

      resetAuthScroll(modal);
      return;
    }

    currentForm.classList.add("leaving");

    authSwitchTimer = window.setTimeout(() => {
      currentForm.classList.remove("active", "leaving");

      nextForm.classList.add("active", "entering");
      resetAuthScroll(modal);

      authEnterTimer = window.setTimeout(() => {
        nextForm.classList.remove("entering");
        resetAuthScroll(modal);
      }, AUTH_ENTER_DELAY);
    }, AUTH_LEAVE_DELAY);
  }

  function trapModalFocus(event) {
    if (event.key === "Escape") {
      closeAuthModal();
      return;
    }

    if (event.key !== "Tab") return;

    const modal = qs("#authModal");
    if (!modal || modal.hidden) return;

    const focusable = qsa(
      'button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      modal,
    ).filter((element) => !element.disabled && element.offsetParent !== null);

    if (!focusable.length) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
      return;
    }

    if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function clearFormErrors(scope) {
    qsa(".form-field", scope).forEach((field) => {
      field.classList.remove("invalid");
    });

    qsa(".field-error", scope).forEach((error) => {
      error.textContent = "";
    });
  }

  function setFieldError(input, message) {
    if (!input) return;

    const field = input.closest(".form-field");
    field?.classList.add("invalid");

    const error = qs(`[data-error-for="${input.id}"]`);
    if (error) {
      error.textContent = message;
    }
  }

  function validateAuthForm(form) {
    clearFormErrors(form);

    let valid = true;

    qsa("input", form).forEach((input) => {
      const value =
        input.type === "checkbox" ? input.checked : input.value.trim();

      if (input.required && !value) {
        setFieldError(
          input,
          input.type === "checkbox"
            ? "پذیرش قوانین الزامی است."
            : "این فیلد الزامی است.",
        );
        valid = false;
        return;
      }

      if (
        input.type === "email" &&
        !/^\S+@\S+\.\S+$/.test(input.value.trim())
      ) {
        setFieldError(input, "ایمیل معتبر وارد کنید.");
        valid = false;
        return;
      }

      if (input.type === "password" && input.value.length < 8) {
        setFieldError(input, "رمز عبور باید حداقل ۸ کاراکتر باشد.");
        valid = false;
        return;
      }

      if (input.name === "name" && input.value.trim().length < 2) {
        setFieldError(input, "نام باید حداقل ۲ کاراکتر باشد.");
        valid = false;
      }
    });

    return valid;
  }

  async function handleLogin(event) {
    event.preventDefault();

    const form = event.currentTarget;
    if (!validateAuthForm(form)) return;

    setLoading(form, true, "در حال ورود...");

    try {
      await apiAdapter.login(form.email.value, form.password.value);

      closeAuthModal();
      toast("با موفقیت وارد شدید.");

      renderAccountNav();
      hydrateAccountPages();
    } catch (error) {
      setFieldError(form.password, error.message);
      toast(error.message, "error");
    } finally {
      setLoading(form, false);
    }
  }

  async function handleSignup(event) {
    event.preventDefault();

    const form = event.currentTarget;
    if (!validateAuthForm(form)) return;

    setLoading(form, true, "در حال ساخت حساب...");

    try {
      await apiAdapter.signup({
        name: form.name.value,
        email: form.email.value,
        password: form.password.value,
      });

      closeAuthModal();
      toast("حساب شما ساخته شد و وارد شدید.");

      renderAccountNav();
      hydrateAccountPages();
    } catch (error) {
      setFieldError(form.email, error.message);
      toast(error.message, "error");
    } finally {
      setLoading(form, false);
    }
  }

  function setLoading(form, loading, text = "") {
    const button = qs(".auth-submit, .settings-submit", form);

    qsa("input, button", form).forEach((element) => {
      if (!element.matches("[data-auth-tab]")) {
        element.disabled = loading;
      }
    });

    if (!button) return;

    const label = qs("span", button) || button;

    if (!button.dataset.defaultText) {
      button.dataset.defaultText = label.textContent.trim();
    }

    button.classList.toggle("loading", loading);
    label.textContent = loading ? text : button.dataset.defaultText;
  }

  function hydrateAccountPages() {
    const user = getCurrentUser();
    const sub = getCurrentSubscription();
    const plan = plans[sub?.plan || "basic"] || plans.basic;

    qsa("[data-account-name]").forEach((element) => {
      element.textContent = user?.name || "کاربر مهمان";
    });

    qsa("[data-account-email]").forEach((element) => {
      element.textContent = user?.email || "وارد نشده";
    });

    qsa("[data-account-avatar]").forEach((element) => {
      element.textContent = user ? initials(user.name, user.email) : "?";
    });

    qsa("[data-subscription-plan]").forEach((element) => {
      element.textContent = plan.label;
    });

    qsa("[data-subscription-priority]").forEach((element) => {
      element.textContent = plan.priority;
    });

    const settingsForm = qs("#accountSettingsForm");

    if (settingsForm && user) {
      settingsForm.name.value = user.name;
      settingsForm.email.value = user.email;
    }

    updatePlanCards();
    protectPage();
  }

  function protectPage() {
    if (document.body.dataset.protected !== "true") return;

    const user = getCurrentUser();
    const protectedContents = qsa(".protected-content");
    let gate = qs("#authGate");

    if (user) {
      protectedContents.forEach((section) => section.removeAttribute("hidden"));
      gate?.remove();
      return;
    }

    protectedContents.forEach((section) => section.setAttribute("hidden", ""));

    if (gate) return;

    gate = document.createElement("section");
    gate.id = "authGate";
    gate.className = "auth-gate container";

    gate.innerHTML = `
      <div class="auth-gate-card">
        <span class="auth-badge">Account Required</span>
        <h1>برای مشاهده این صفحه وارد حساب شوید</h1>
        <p>برای دسترسی به داشبورد، پروفایل و تنظیمات حساب، ابتدا وارد حساب کاربری خود شوید.</p>

        <div class="account-actions">
          <button class="btn primary" type="button" data-open-auth="login">ورود به حساب</button>
          <a class="btn ghost" href="${routes.home}">بازگشت به خانه</a>
        </div>
      </div>
    `;

    const main = qs("#main-content") || document.body;
    main.prepend(gate);

    qs("[data-open-auth]", gate)?.addEventListener("click", () => {
      openAuthModal("login");
    });
  }

  function initSettingsForm() {
    const form = qs("#accountSettingsForm");
    if (!form || form.dataset.bound === "true") return;

    form.dataset.bound = "true";

    const button = qs(".settings-submit", form);
    if (button) {
      button.dataset.defaultText = button.textContent.trim();
    }

    form.addEventListener("submit", async (event) => {
      event.preventDefault();

      clearFormErrors(form);

      const name = form.name.value.trim();
      const email = normalizeEmail(form.email.value);

      let valid = true;

      if (name.length < 2) {
        setFieldError(form.name, "نام باید حداقل ۲ کاراکتر باشد.");
        valid = false;
      }

      if (!/^\S+@\S+\.\S+$/.test(email)) {
        setFieldError(form.email, "ایمیل معتبر وارد کنید.");
        valid = false;
      }

      if (!valid) return;

      if (button) {
        button.disabled = true;
        button.classList.add("loading");
        button.textContent = "در حال ذخیره...";
      }

      try {
        await apiAdapter.updateProfile({ name, email });

        toast("تنظیمات حساب ذخیره شد.");
        renderAccountNav();
        hydrateAccountPages();
      } catch (error) {
        toast(error.message, "error");
        setFieldError(form.email, error.message);
      } finally {
        if (button) {
          button.disabled = false;
          button.classList.remove("loading");
          button.textContent = button.dataset.defaultText || "ذخیره تغییرات";
        }
      }
    });
  }

  function initSubscriptionActions() {
    qsa("[data-plan-checkout]").forEach((button) => {
      if (button.dataset.bound === "true") return;
      button.dataset.bound = "true";

      if (!button.dataset.defaultLabel) {
        button.dataset.defaultLabel =
          button.dataset.label || button.textContent.trim();
      }

      button.addEventListener("click", async () => {
        const user = getCurrentUser();

        if (!user) {
          openAuthModal("login");
          toast("برای فعال‌سازی اشتراک ابتدا وارد حساب شوید.", "error");
          return;
        }

        const original = button.textContent;

        button.disabled = true;
        button.classList.add("loading");
        button.textContent = "در حال آماده‌سازی پرداخت...";

        try {
          const sub = await apiAdapter.subscribe(button.dataset.planCheckout);

          if (!sub) return;

          toast(
            sub.status === "free"
              ? "پلن رایگان فعال شد."
              : "اشتراک شما فعال شد.",
          );

          hydrateAccountPages();
          renderAccountNav();
        } catch (error) {
          toast(error.message, "error");
        } finally {
          button.disabled = false;
          button.classList.remove("loading");
          button.textContent = original;
        }
      });
    });
  }

  function updatePlanCards() {
    const sub = getCurrentSubscription();

    qsa("[data-plan-card]").forEach((card) => {
      const active = sub?.plan === card.dataset.planCard;

      card.classList.toggle("current", active);

      const button = qs("[data-plan-checkout]", card);
      if (!button) return;

      if (!button.dataset.defaultLabel) {
        button.dataset.defaultLabel =
          button.dataset.label || button.textContent.trim();
      }

      button.textContent = active
        ? "پلن فعلی شما"
        : button.dataset.defaultLabel;
      button.disabled = active;
    });
  }

  function initPlaceholderActions() {
    qsa("[data-placeholder-action]").forEach((button) => {
      if (button.dataset.bound === "true") return;
      button.dataset.bound = "true";

      button.addEventListener("click", () => {
        toast(
          button.dataset.placeholderAction ||
            "این قابلیت بعد از اتصال بک‌اند فعال می‌شود.",
          "info",
        );
      });
    });

    qsa("[data-settings-logout]").forEach((button) => {
      if (button.dataset.bound === "true") return;
      button.dataset.bound = "true";

      button.addEventListener("click", async () => {
        const logoutButton = qs("[data-logout]");

        if (logoutButton) {
          logoutButton.click();
          return;
        }

        await apiAdapter.logout();
        window.location.href = routes.home;
      });
    });
  }

  function initAuthOpenButtons() {
    qsa("[data-open-auth]").forEach((button) => {
      if (button.dataset.authBound === "true") return;
      button.dataset.authBound = "true";

      button.addEventListener("click", () => {
        openAuthModal(button.dataset.openAuth || "login");
      });
    });
  }
  function initChangePasswordForm() {
    const form = qs("#changePasswordForm");
    if (!form || form.dataset.bound === "true") return;

    form.dataset.bound = "true";

    form.addEventListener("submit", async (event) => {
      event.preventDefault();

      clearFormErrors(form);

      const currentPassword = form.current_password.value;
      const newPassword = form.new_password.value;

      if (currentPassword.length < 8) {
        setFieldError(
          form.current_password,
          "رمز عبور فعلی باید حداقل ۸ کاراکتر باشد.",
        );
        return;
      }

      if (newPassword.length < 8) {
        setFieldError(
          form.new_password,
          "رمز عبور جدید باید حداقل ۸ کاراکتر باشد.",
        );
        return;
      }

      try {
        await request("/me/password", {
          method: "PATCH",
          body: {
            current_password: currentPassword,
            new_password: newPassword,
          },
        });

        form.reset();
        toast("رمز عبور با موفقیت تغییر کرد.");
      } catch (error) {
        toast(error.message, "error");
        setFieldError(form.current_password, error.message);
      }
    });
  }

  document.addEventListener("DOMContentLoaded", async () => {
    createAccountNav();
    createAuthModal();
    initAuthOpenButtons();
    initSettingsForm();
    initChangePasswordForm();
    initSubscriptionActions();
    initPlaceholderActions();

    await loadAccountState();
  });
})();
