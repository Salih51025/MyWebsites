/**
 * Admin entry shim.
 *
 * The admin implementation was split into smaller modules for readability:
 * - admin-core.js
 * - admin-login.js
 * - admin-projects.form.js
 * - admin-projects.uploads.js
 * - admin-projects.table.js
 * - admin-projects.page.js
 *
 * This file is kept for backward compatibility. When loaded after the split
 * modules, it does nothing. When loaded standalone, it loads the required
 * modules and preserves the original window.AdminApp API.
 */
(function () {
  window.AdminApp = window.AdminApp || {};

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const existing = Array.from(document.scripts).find((s) => (s.getAttribute("src") || "").endsWith(src));
      if (existing) {
        if (existing.dataset.loaded === "true" || window.AdminApp.core) return resolve();
        existing.addEventListener("load", () => resolve(), { once: true });
        existing.addEventListener("error", () => reject(new Error(`Script yüklenemedi: ${src}`)), { once: true });
        return;
      }
      const script = document.createElement("script");
      script.src = src;
      script.async = false;
      script.addEventListener("load", () => { script.dataset.loaded = "true"; resolve(); }, { once: true });
      script.addEventListener("error", () => reject(new Error(`Script yüklenemedi: ${src}`)), { once: true });
      document.head.appendChild(script);
    });
  }

  async function ensureLoginModules() {
    if (window.AdminApp.core && window.AdminApp.initLoginPage && window.AdminApp.initLoginPage.__split) return;
    await loadScript("./admin-core.js");
    await loadScript("./admin-login.js");
  }

  async function ensureProjectsModules() {
    if (window.AdminApp.core && window.AdminApp.initProjectsPage && window.AdminApp.initProjectsPage.__split) return;
    await loadScript("./admin-core.js");
    await loadScript("./admin-projects.form.js");
    await loadScript("./admin-projects.uploads.js");
    await loadScript("./admin-projects.table.js");
    await loadScript("./admin-projects.page.js");
  }

  if (!window.AdminApp.initLoginPage) {
    window.AdminApp.initLoginPage = async function initLoginPageCompat() {
      await ensureLoginModules();
      return window.AdminApp.initLoginPage && window.AdminApp.initLoginPage();
    };
  }

  if (!window.AdminApp.initProjectsPage) {
    window.AdminApp.initProjectsPage = async function initProjectsPageCompat() {
      await ensureProjectsModules();
      return window.AdminApp.initProjectsPage && window.AdminApp.initProjectsPage();
    };
  }
})();
