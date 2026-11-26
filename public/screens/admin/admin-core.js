(function () {
  window.AdminApp = window.AdminApp || {};

  let csrfTokenCache = null;

  async function fetchCsrfToken() {
    const res = await fetch("/api/admin/csrf", { credentials: "same-origin", headers: { "Accept": "application/json" } });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.csrfToken) {
      throw new Error((data && data.error) || "CSRF token alınamadı.");
    }
    csrfTokenCache = data.csrfToken;
    return csrfTokenCache;
  }

  async function ensureCsrfToken(force = false) {
    if (!force && csrfTokenCache) return csrfTokenCache;
    return fetchCsrfToken();
  }

  async function api(url, options = {}) {
    const opts = { credentials: "same-origin", ...options };
    const method = (opts.method || "GET").toUpperCase();
    opts.headers = { ...(options.headers || {}) };

    if (opts.body && !(opts.body instanceof FormData) && !opts.headers["Content-Type"]) {
      opts.headers["Content-Type"] = "application/json";
    }

    if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
      const token = await ensureCsrfToken(false);
      opts.headers["X-CSRF-Token"] = token;
    }

    let res = await fetch(url, opts);
    let contentType = res.headers.get("content-type") || "";
    let data = contentType.includes("application/json") ? await res.json().catch(() => ({})) : await res.text();

    if (!res.ok && res.status === 403 && !["GET", "HEAD", "OPTIONS"].includes(method) && data && data.error && String(data.error).toLowerCase().includes("csrf")) {
      const token = await ensureCsrfToken(true);
      opts.headers["X-CSRF-Token"] = token;
      res = await fetch(url, opts);
      contentType = res.headers.get("content-type") || "";
      data = contentType.includes("application/json") ? await res.json().catch(() => ({})) : await res.text();
    }

    if (data && typeof data === "object" && data.csrfToken) {
      csrfTokenCache = data.csrfToken;
    }

    if (!res.ok) {
      const message = (data && data.error) || (typeof data === "string" && data) || `İstek başarısız (${res.status})`;
      const error = new Error(message);
      error.status = res.status;
      error.data = data;
      throw error;
    }
    return data;
  }

  function setCsrfToken(token) {
    csrfTokenCache = token || null;
  }

  function setStatus(el, message, type) {
    if (!el) return;
    el.textContent = message || "";
    el.className = "status" + (type ? " " + type : "");
  }

  function linesToArray(text) {
    return String(text || "")
      .split(/\r?\n+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  function arrayToLines(arr) {
    return Array.isArray(arr) ? arr.join("\n") : "";
  }

  function escapeAttr(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function nextOrderFromProjects(projects) {
    const max = (projects || []).reduce((m, p) => Math.max(m, Number(p.order) || 0), 0);
    return max + 1;
  }

  function formatBytes(bytes) {
    const n = Number(bytes);
    if (!Number.isFinite(n) || n < 0) return "-";
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  }

  window.AdminApp.core = {
    api,
    arrayToLines,
    ensureCsrfToken,
    escapeAttr,
    fetchCsrfToken,
    formatBytes,
    linesToArray,
    nextOrderFromProjects,
    setCsrfToken,
    setStatus,
  };
})();
