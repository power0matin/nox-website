(() => {
  "use strict";

  const API_BASE_URL = window.NOX_API_BASE_URL || "/api";

  const qs = (selector, scope = document) => scope.querySelector(selector);
  const qsa = (selector, scope = document) =>
    Array.from(scope.querySelectorAll(selector));

  const state = {
    me: null,
    users: [],
    filteredUsers: [],
    loading: false,
  };

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>'"]/g, (char) => {
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

  function normalize(value) {
    return String(value || "")
      .trim()
      .toLowerCase();
  }

  function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);

    if (parts.length !== 2) return "";

    return parts.pop().split(";").shift() || "";
  }

  function csrfHeaders() {
    const token = getCookie("csrf_token");

    return token
      ? {
          "X-CSRF-Token": token,
        }
      : {};
  }

  async function adminRequest(path, options = {}) {
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
        data?.detail ||
          data?.message ||
          "درخواست ناموفق بود. لطفاً دوباره تلاش کنید.",
      );
    }

    return data;
  }

  function showAdminToast(message, type = "success") {
    const container = qs("#toast-container");

    if (!container) {
      alert(message);
      return;
    }

    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.setAttribute("role", type === "error" ? "alert" : "status");

    toast.innerHTML = `
      <div class="toast-icon" aria-hidden="true">●</div>
      <div class="toast-text"></div>
      <button class="toast-close" type="button" aria-label="بستن پیام">×</button>
    `;

    qs(".toast-text", toast).textContent = message;
    container.appendChild(toast);

    const close = () => {
      toast.classList.add("hide");
      window.setTimeout(() => toast.remove(), 360);
    };

    const timer = window.setTimeout(close, 3200);

    qs(".toast-close", toast)?.addEventListener("click", () => {
      window.clearTimeout(timer);
      close();
    });
  }

  function setMessage(message, type = "info") {
    const el = qs("#adminMessage");
    if (!el) return;

    if (!message) {
      el.hidden = true;
      el.textContent = "";
      el.className = "admin-message";
      return;
    }

    el.hidden = false;
    el.textContent = message;
    el.className = `admin-message ${type}`;
  }

  function setStatus(message) {
    const el = qs("#adminStatus");
    if (el) el.textContent = message;
  }

  function toPersianNumber(value) {
    try {
      return new Intl.NumberFormat("fa-IR").format(Number(value || 0));
    } catch (_) {
      return String(value || 0);
    }
  }

  function formatDate(value) {
    if (!value) return "—";

    try {
      return new Intl.DateTimeFormat("fa-IR", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value));
    } catch (_) {
      return value;
    }
  }

  function planLabel(plan) {
    const labels = {
      basic: "رایگان",
      priority: "Priority",
      elite: "Elite",
    };

    return labels[plan] || plan || "—";
  }

  function statusLabel(status) {
    const labels = {
      free: "رایگان",
      active: "فعال",
      expired: "منقضی",
      cancelled: "لغو شده",
    };

    return labels[status] || status || "—";
  }

  function initials(name, email) {
    const source = String(name || email || "N").trim();
    const parts = source.split(/\s+/).filter(Boolean);

    if (parts.length > 1) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }

    return source.slice(0, 2).toUpperCase();
  }

  async function copyText(value) {
    const text = String(value || "").trim();
    if (!text) return false;

    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (_) {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";

      document.body.appendChild(textarea);
      textarea.select();

      let ok = false;

      try {
        ok = document.execCommand("copy");
      } catch (_) {
        ok = false;
      }

      textarea.remove();
      return ok;
    }
  }

  function getFilters() {
    return {
      search: normalize(qs("#adminSearch")?.value),
      plan: qs("#adminPlanFilter")?.value || "all",
      status: qs("#adminStatusFilter")?.value || "all",
      ban: qs("#adminBanFilter")?.value || "all",
    };
  }

  function applyFilters() {
    const filters = getFilters();

    state.filteredUsers = state.users.filter((user) => {
      const sub = user.subscription || {};
      const searchable = normalize(
        `${user.name} ${user.email} ${user.id} ${sub.plan} ${sub.status}`,
      );

      const matchesSearch =
        !filters.search || searchable.includes(filters.search);

      const matchesPlan = filters.plan === "all" || sub.plan === filters.plan;

      const matchesStatus =
        filters.status === "all" || sub.status === filters.status;

      const matchesBan =
        filters.ban === "all" ||
        (filters.ban === "banned" && user.isBanned) ||
        (filters.ban === "free" && !user.isBanned);

      return matchesSearch && matchesPlan && matchesStatus && matchesBan;
    });

    renderUsers();
    renderStats();
  }

  function renderStats() {
    const users = state.users;
    const paid = users.filter((user) => {
      const sub = user.subscription || {};
      return (
        sub.status === "active" && ["priority", "elite"].includes(sub.plan)
      );
    });

    const elite = users.filter((user) => user.subscription?.plan === "elite");
    const banned = users.filter((user) => user.isBanned);

    const stats = {
      adminTotalUsers: users.length,
      adminPaidUsers: paid.length,
      adminEliteUsers: elite.length,
      adminBannedUsers: banned.length,
    };

    Object.entries(stats).forEach(([id, value]) => {
      const el = qs(`#${id}`);
      if (el) el.textContent = toPersianNumber(value);
    });
  }

  function renderUsers() {
    const body = qs("#adminUsersBody");
    if (!body) return;

    const users = state.filteredUsers;

    if (!users.length) {
      body.innerHTML = `
        <tr>
          <td colspan="8">
            <div class="admin-empty">کاربری با این فیلترها پیدا نشد.</div>
          </td>
        </tr>
      `;

      setStatus("هیچ نتیجه‌ای برای نمایش وجود ندارد.");
      return;
    }

    body.innerHTML = users.map(renderUserRow).join("");

    setStatus(`${toPersianNumber(users.length)} کاربر نمایش داده می‌شود.`);
  }

  function renderUserRow(user) {
    const sub = user.subscription || {};
    const plan = sub.plan || "basic";
    const status = sub.status || "free";
    const isSelf = state.me?.id === user.id;

    return `
      <tr data-user-id="${escapeHtml(user.id)}">
        <td>
          <div class="admin-user-cell">
            <span class="admin-avatar" aria-hidden="true">${escapeHtml(initials(user.name, user.email))}</span>

            <div class="admin-user-info">
              <strong>${escapeHtml(user.name || "—")}</strong>
              <small title="${escapeHtml(user.email || "")}">${escapeHtml(user.email || "—")}</small>
              <div class="admin-user-id" data-admin-copy="${escapeHtml(user.id)}" title="کپی ID">
                ${escapeHtml(user.id)}
              </div>
            </div>
          </div>
        </td>

        <td>
          <span class="admin-chip ${user.isAdmin ? "admin" : "normal"}">
            ${user.isAdmin ? "ادمین" : "کاربر"}
          </span>
        </td>

        <td>
          <span class="admin-chip ${user.isBanned ? "banned" : "free-account"}">
            ${user.isBanned ? "مسدود" : "فعال"}
          </span>
        </td>

        <td>
          <span class="admin-chip plan-${escapeHtml(plan)}">
            ${escapeHtml(planLabel(plan))}
          </span>
          <span class="admin-chip status-${escapeHtml(status)}">
            ${escapeHtml(statusLabel(status))}
          </span>
        </td>

        <td>
          <span class="admin-chip">
            ${toPersianNumber(sub.queuePriority || 0)}
          </span>
        </td>

        <td>${escapeHtml(formatDate(sub.currentPeriodEnd))}</td>

        <td>
          <div class="admin-subscription-control">
            <select data-admin-plan-select aria-label="پلن کاربر">
              <option value="basic" ${plan === "basic" ? "selected" : ""}>Basic</option>
              <option value="priority" ${plan === "priority" ? "selected" : ""}>Priority</option>
              <option value="elite" ${plan === "elite" ? "selected" : ""}>Elite</option>
            </select>

            <select data-admin-status-select aria-label="وضعیت اشتراک">
              <option value="free" ${status === "free" ? "selected" : ""}>رایگان</option>
              <option value="active" ${status === "active" ? "selected" : ""}>فعال</option>
              <option value="expired" ${status === "expired" ? "selected" : ""}>منقضی</option>
              <option value="cancelled" ${status === "cancelled" ? "selected" : ""}>لغو شده</option>
            </select>

            <button class="admin-mini-btn primary" type="button" data-admin-update-subscription>
              ذخیره اشتراک
            </button>
          </div>
        </td>

        <td>
          <div class="admin-row-actions">
            <button class="admin-mini-btn" type="button" data-admin-details>
              جزئیات
            </button>

            <button class="admin-mini-btn" type="button" data-admin-copy="${escapeHtml(user.email || "")}">
              کپی ایمیل
            </button>

            <button class="admin-mini-btn ${user.isBanned ? "success" : "danger"}" type="button"
              data-admin-ban-toggle="${user.isBanned ? "false" : "true"}"
              ${isSelf ? "disabled title='نمی‌توانید حساب خودتان را مسدود کنید'" : ""}>
              ${user.isBanned ? "آزادسازی" : "مسدودسازی"}
            </button>
          </div>
        </td>
      </tr>
    `;
  }

  async function guardAdmin() {
    const data = await adminRequest("/me");
    state.me = data.user || null;

    if (!state.me?.isAdmin) {
      qs("#adminApp")?.setAttribute("hidden", "");
      qs("#adminAccessBox")?.removeAttribute("hidden");
      throw new Error("دسترسی ادمین ندارید.");
    }

    qs("#adminAccessBox")?.setAttribute("hidden", "");
    qs("#adminApp")?.removeAttribute("hidden");
  }

  async function loadUsers() {
    const body = qs("#adminUsersBody");
    if (!body || state.loading) return;

    state.loading = true;
    setMessage("");
    setStatus("در حال دریافت کاربران...");

    body.innerHTML = `
      <tr>
        <td colspan="8">
          <div class="admin-empty">در حال بارگذاری...</div>
        </td>
      </tr>
    `;

    try {
      await guardAdmin();

      const data = await adminRequest("/admin/users");

      state.users = Array.isArray(data.users) ? data.users : [];
      state.filteredUsers = [...state.users];

      applyFilters();

      showAdminToast("لیست کاربران بروزرسانی شد.");
    } catch (error) {
      state.users = [];
      state.filteredUsers = [];

      body.innerHTML = `
        <tr>
          <td colspan="8">
            <div class="admin-empty">${escapeHtml(error.message)}</div>
          </td>
        </tr>
      `;

      setStatus(error.message);
      setMessage(error.message, "error");
    } finally {
      state.loading = false;
    }
  }

  function getUserFromRow(row) {
    const userId = row?.dataset.userId;
    return state.users.find((user) => user.id === userId) || null;
  }

  async function updateSubscription(row) {
    const user = getUserFromRow(row);
    if (!user) return;

    const plan = qs("[data-admin-plan-select]", row)?.value;
    const status = qs("[data-admin-status-select]", row)?.value;

    if (!plan || !status) return;

    await adminRequest(
      `/admin/users/${encodeURIComponent(user.id)}/subscription`,
      {
        method: "PATCH",
        body: {
          plan,
          status,
        },
      },
    );

    showAdminToast("اشتراک کاربر بروزرسانی شد.");
    await loadUsers();
  }

  async function toggleBan(row, nextValue) {
    const user = getUserFromRow(row);
    if (!user) return;

    const action = nextValue ? "مسدود" : "آزاد";

    const ok = window.confirm(
      `آیا مطمئن هستید که می‌خواهید این کاربر را ${action} کنید؟`,
    );
    if (!ok) return;

    await adminRequest(`/admin/users/${encodeURIComponent(user.id)}/ban`, {
      method: "PATCH",
      body: {
        is_banned: nextValue,
      },
    });

    showAdminToast(nextValue ? "کاربر مسدود شد." : "کاربر آزاد شد.");
    await loadUsers();
  }

  function openDetails(row) {
    const user = getUserFromRow(row);
    if (!user) return;

    const sub = user.subscription || {};
    const modal = qs("#adminUserModal");
    const body = qs("#adminModalBody");

    if (!modal || !body) return;

    qs("#adminModalTitle").textContent = user.name || "جزئیات کاربر";
    qs("#adminModalSubtitle").textContent = user.email || "بدون ایمیل";

    body.innerHTML = `
      <div class="admin-detail-grid">
        <div class="admin-detail-item">
          <span>شناسه کاربر</span>
          <strong>${escapeHtml(user.id)}</strong>
        </div>

        <div class="admin-detail-item">
          <span>ایمیل</span>
          <strong>${escapeHtml(user.email)}</strong>
        </div>

        <div class="admin-detail-item">
          <span>نام</span>
          <strong>${escapeHtml(user.name)}</strong>
        </div>

        <div class="admin-detail-item">
          <span>نقش</span>
          <strong>${user.isAdmin ? "ادمین" : "کاربر عادی"}</strong>
        </div>

        <div class="admin-detail-item">
          <span>وضعیت حساب</span>
          <strong>${user.isBanned ? "مسدود" : "فعال"}</strong>
        </div>

        <div class="admin-detail-item">
          <span>تاریخ ساخت</span>
          <strong>${escapeHtml(formatDate(user.createdAt))}</strong>
        </div>

        <div class="admin-detail-item">
          <span>پلن</span>
          <strong>${escapeHtml(planLabel(sub.plan))}</strong>
        </div>

        <div class="admin-detail-item">
          <span>وضعیت اشتراک</span>
          <strong>${escapeHtml(statusLabel(sub.status))}</strong>
        </div>

        <div class="admin-detail-item">
          <span>اولویت صف</span>
          <strong>${toPersianNumber(sub.queuePriority || 0)}</strong>
        </div>

        <div class="admin-detail-item">
          <span>انقضای اشتراک</span>
          <strong>${escapeHtml(formatDate(sub.currentPeriodEnd))}</strong>
        </div>
      </div>

      <div class="admin-detail-actions">
        <button class="admin-mini-btn" type="button" data-admin-copy="${escapeHtml(user.id)}">کپی User ID</button>
        <button class="admin-mini-btn" type="button" data-admin-copy="${escapeHtml(user.email)}">کپی ایمیل</button>
      </div>
    `;

    modal.hidden = false;
    qs(".admin-modal-card", modal)?.focus({ preventScroll: true });
  }

  function closeModal() {
    const modal = qs("#adminUserModal");
    if (modal) modal.hidden = true;
  }

  function exportCsv() {
    const users = state.filteredUsers.length
      ? state.filteredUsers
      : state.users;

    if (!users.length) {
      showAdminToast("کاربری برای خروجی گرفتن وجود ندارد.", "error");
      return;
    }

    const headers = [
      "id",
      "name",
      "email",
      "is_admin",
      "is_banned",
      "plan",
      "status",
      "queue_priority",
      "current_period_end",
      "created_at",
    ];

    const rows = users.map((user) => {
      const sub = user.subscription || {};

      return [
        user.id,
        user.name,
        user.email,
        user.isAdmin,
        user.isBanned,
        sub.plan,
        sub.status,
        sub.queuePriority,
        sub.currentPeriodEnd,
        user.createdAt,
      ];
    });

    const csv = [headers, ...rows]
      .map((row) =>
        row
          .map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`)
          .join(","),
      )
      .join("\n");

    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `nox-users-${Date.now()}.csv`;

    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);

    showAdminToast("خروجی CSV ساخته شد.");
  }

  function resetFilters() {
    const fields = {
      adminSearch: "",
      adminPlanFilter: "all",
      adminStatusFilter: "all",
      adminBanFilter: "all",
    };

    Object.entries(fields).forEach(([id, value]) => {
      const el = qs(`#${id}`);
      if (el) el.value = value;
    });

    applyFilters();
  }

  function bindEvents() {
    qs("#refreshAdminUsers")?.addEventListener("click", loadUsers);
    qs("#adminExportCsv")?.addEventListener("click", exportCsv);
    qs("#adminResetFilters")?.addEventListener("click", resetFilters);

    [
      "#adminSearch",
      "#adminPlanFilter",
      "#adminStatusFilter",
      "#adminBanFilter",
    ].forEach((selector) => {
      qs(selector)?.addEventListener("input", applyFilters);
      qs(selector)?.addEventListener("change", applyFilters);
    });

    document.addEventListener("click", async (event) => {
      const updateButton = event.target.closest(
        "[data-admin-update-subscription]",
      );
      const banButton = event.target.closest("[data-admin-ban-toggle]");
      const detailsButton = event.target.closest("[data-admin-details]");
      const copyButton = event.target.closest("[data-admin-copy]");
      const closeButton = event.target.closest("[data-admin-modal-close]");

      try {
        if (closeButton) {
          closeModal();
          return;
        }

        if (copyButton) {
          const value = copyButton.dataset.adminCopy;
          const ok = await copyText(value);

          showAdminToast(
            ok ? "کپی شد." : "کپی انجام نشد.",
            ok ? "success" : "error",
          );
          return;
        }

        if (detailsButton) {
          openDetails(detailsButton.closest("[data-user-id]"));
          return;
        }

        if (updateButton) {
          updateButton.disabled = true;
          await updateSubscription(updateButton.closest("[data-user-id]"));
          return;
        }

        if (banButton) {
          banButton.disabled = true;
          await toggleBan(
            banButton.closest("[data-user-id]"),
            banButton.dataset.adminBanToggle === "true",
          );
        }
      } catch (error) {
        showAdminToast(error.message, "error");

        if (updateButton) updateButton.disabled = false;
        if (banButton) banButton.disabled = false;
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeModal();
      }
    });
  }

  function init() {
    if (!qs("#adminUsersBody")) return;

    bindEvents();

    window.setTimeout(loadUsers, 450);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
