(function () {
  window.AdminApp = window.AdminApp || {};
  const { api, ensureCsrfToken, setCsrfToken, setStatus } = window.AdminApp.core;

  function initLoginPage() {
    const form = document.getElementById("login-form");
    const statusEl = document.getElementById("login-status");
    if (!form) return;

    ensureCsrfToken().catch(() => {});
    api("/api/admin/me").then((data) => {
      if (data && data.csrfToken) setCsrfToken(data.csrfToken);
      window.location.href = "./admin-projects.html";
    }).catch(() => {});

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      setStatus(statusEl, "Giriş yapılıyor...", "");
      const username = document.getElementById("username").value.trim();
      const password = document.getElementById("password").value;
      try {
        const data = await api("/api/admin/login", {
          method: "POST",
          body: JSON.stringify({ username, password }),
        });
        if (data && data.csrfToken) setCsrfToken(data.csrfToken);
        setStatus(statusEl, "Giriş başarılı, yönlendiriliyorsunuz...", "success");
        window.location.href = "./admin-projects.html";
      } catch (error) {
        setStatus(statusEl, error.message || "Giriş başarısız.", "error");
      }
    });
  }

  initLoginPage.__split = true;
  window.AdminApp.initLoginPage = initLoginPage;
})();
