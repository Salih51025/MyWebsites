(function () {
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

  /* ---------------------- Login Page ---------------------- */
  function initLoginPage() {
    const form = document.getElementById("login-form");
    const statusEl = document.getElementById("login-status");
    if (!form) return;

    ensureCsrfToken().catch(() => {});
    api("/api/admin/me").then((data) => {
      if (data && data.csrfToken) csrfTokenCache = data.csrfToken;
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
        if (data && data.csrfToken) csrfTokenCache = data.csrfToken;
        setStatus(statusEl, "Giriş başarılı, yönlendiriliyorsunuz...", "success");
        window.location.href = "./admin-projects.html";
      } catch (error) {
        setStatus(statusEl, error.message || "Giriş başarısız.", "error");
      }
    });
  }

  /* ---------------------- Projects Admin Page ---------------------- */
  function initProjectsPage() {
    const state = {
      projects: [],
      uploads: [],
      uploadSet: new Set(),
      uploadSelection: new Set(),
      uploadsSearch: "",
      uploadsFilter: "all",
      editingId: null,
      orderDirty: false,
    };

    const els = {
      pageStatus: document.getElementById("page-status"),
      tableBody: document.getElementById("projects-table-body"),
      form: document.getElementById("project-form"),
      formTitle: document.getElementById("form-title"),
      editingIdLabel: document.getElementById("editing-id"),
      formStatus: document.getElementById("form-status"),
      formErrors: document.getElementById("form-errors"),
      projectPreview: document.getElementById("project-preview"),
      deleteBtn: document.getElementById("delete-project-btn"),
      newBtn: document.getElementById("new-project-btn"),
      refreshBtn: document.getElementById("refresh-btn"),
      logoutBtn: document.getElementById("logout-btn"),
      resetBtn: document.getElementById("reset-form-btn"),
      imageList: document.getElementById("image-list"),
      addImageRowBtn: document.getElementById("add-image-row-btn"),
      uploadInput: document.getElementById("image-upload-input"),
      uploadBtn: document.getElementById("upload-images-btn"),
      saveOrderBtn: document.getElementById("save-order-btn"),
      cleanupUploadsBtn: document.getElementById("cleanup-uploads-btn"),
      uploadsList: document.getElementById("uploads-list"),
      refreshUploadsBtn: document.getElementById("refresh-uploads-btn"),
      cleanupBrokenRefsBtn: document.getElementById("cleanup-broken-refs-btn"),
      uploadsSearch: document.getElementById("uploads-search"),
      uploadsFilter: document.getElementById("uploads-filter"),
      selectAllUploadsBtn: document.getElementById("select-all-uploads-btn"),
      clearUploadSelectionBtn: document.getElementById("clear-upload-selection-btn"),
      addSelectedUploadsBtn: document.getElementById("add-selected-uploads-btn"),
      uploadsSelectionStatus: document.getElementById("uploads-selection-status"),
    };

    function isUploadSrc(src) {
      if (typeof src !== "string" || !src) return false;
      if (src.startsWith("/uploads/projects/")) return true;
      try {
        const url = new URL(src);
        return url.hostname.endsWith(".blob.vercel-storage.com") || url.pathname.includes("/projects/");
      } catch (_e) {
        return false;
      }
    }

    function uploadFilenameFromSrc(src) {
      if (!isUploadSrc(src)) return null;
      try {
        const clean = src.split("?")[0];
        const parts = clean.split("/");
        return parts[parts.length - 1] || null;
      } catch (_e) {
        return null;
      }
    }

    function setFormErrors(errors) {
      if (!els.formErrors) return;
      const items = Array.isArray(errors) ? errors.filter(Boolean) : [];
      if (!items.length) {
        els.formErrors.innerHTML = "";
        els.formErrors.classList.remove("visible");
        return;
      }
      els.formErrors.innerHTML = `<strong>Lütfen aşağıdaki alanları kontrol edin:</strong><ul>${items.map((e) => `<li>${escapeAttr(e.message || e)}</li>`).join("")}</ul>`;
      els.formErrors.classList.add("visible");
    }

    function clearFieldInvalidStates() {
      if (!els.form) return;
      els.form.querySelectorAll(".invalid").forEach((el) => el.classList.remove("invalid"));
    }

    function markInvalidField(id) {
      const el = document.getElementById(id);
      if (el) el.classList.add("invalid");
    }

    function validateFormDataClient(data) {
      const errors = [];
      if (!data.order || data.order < 1) errors.push({ field: "order", message: "Sıra (Order) 1 veya daha büyük olmalıdır." });
      if (!data.category.tr) errors.push({ field: "category-tr", message: "Kategori (TR) zorunludur." });
      if (!data.category.en) errors.push({ field: "category-en", message: "Kategori (EN) zorunludur." });
      if (!data.title.tr) errors.push({ field: "title-tr", message: "Başlık (TR) zorunludur." });
      if (!data.title.en) errors.push({ field: "title-en", message: "Başlık (EN) zorunludur." });
      if (!Array.isArray(data.description.tr) || data.description.tr.length === 0) errors.push({ field: "description-tr", message: "Açıklama (TR) için en az bir paragraf girin." });
      if (!Array.isArray(data.description.en) || data.description.en.length === 0) errors.push({ field: "description-en", message: "Açıklama (EN) için en az bir paragraf girin." });
      if (!Array.isArray(data.images) || data.images.length === 0) errors.push({ field: "image-list", message: "En az bir görsel eklenmelidir." });
      if (Array.isArray(data.images)) {
        data.images.forEach((img, idx) => {
          if (!img.src) errors.push({ field: "image-list", message: `Görsel #${idx + 1} için yol/URL boş olamaz.` });
        });
      }
      return errors;
    }

    function setContentLangTab(lang) {
      const target = lang === "en" ? "en" : "tr";
      document.querySelectorAll('[data-lang-tab]').forEach((btn) => {
        const active = btn.getAttribute('data-lang-tab') === target;
        btn.classList.toggle('active', active);
        btn.setAttribute('aria-selected', String(active));
      });
      document.querySelectorAll('[data-lang-panel]').forEach((panel) => {
        panel.classList.toggle('active', panel.getAttribute('data-lang-panel') === target);
      });
    }

    function applyValidationUI(errors) {
      clearFieldInvalidStates();
      setFormErrors(errors);
      (errors || []).forEach((err) => {
        if (err.field && err.field !== "image-list") markInvalidField(err.field);
      });
      if (errors && errors.length) {
        const first = errors.find((e) => e.field && e.field !== "image-list");
        if (first) {
          if (/-en$/.test(first.field) || first.field === "description-en") setContentLangTab("en");
          else if (/-tr$/.test(first.field) || first.field === "description-tr") setContentLangTab("tr");
          const el = document.getElementById(first.field);
          if (el && typeof el.focus === "function") el.focus();
        }
      }
    }

    function syncOrderLabelsFromState() {
      state.projects.forEach((p, i) => {
        p.order = i + 1;
        p.numberLabel = String(i + 1).padStart(2, "0");
      });
    }

    function getImageRows() {
      return Array.from(els.imageList.querySelectorAll(".image-item"));
    }

    function collectImagesFromForm() {
      return getImageRows().map((row) => {
        const src = (row.querySelector('[data-field="src"]')?.value || "").trim();
        const altTr = (row.querySelector('[data-field="alt-tr"]')?.value || "").trim();
        const altEn = (row.querySelector('[data-field="alt-en"]')?.value || "").trim();
        return { src, alt: { en: altEn, tr: altTr } };
      }).filter((img) => img.src);
    }

    function getImageStatusInfo(src) {
      if (!src) return { text: "Yol boş", cls: "bad" };
      if (isUploadSrc(src)) {
        const filename = uploadFilenameFromSrc(src);
        if (filename && state.uploadSet.has(filename)) return { text: "Yükleme dosyası mevcut", cls: "good" };
        return { text: "Yükleme dosyası bulunamadı (kırık referans olabilir)", cls: "bad" };
      }
      if (/^https?:\/\//i.test(src)) return { text: "Harici URL", cls: "" };
      return { text: "Yerel/statik yol", cls: "" };
    }

    function updateImageRowStatus(row) {
      const srcInput = row.querySelector('[data-field="src"]');
      const statusEl = row.querySelector('[data-role="image-status"]');
      if (!srcInput || !statusEl) return;
      const info = getImageStatusInfo(srcInput.value.trim());
      statusEl.textContent = info.text;
      statusEl.className = "image-status" + (info.cls ? " " + info.cls : "");
    }

    function renderImageItem(image) {
      const row = document.createElement("div");
      row.className = "image-item";
      const src = image && image.src ? image.src : "";
      const alt = image && image.alt ? image.alt : {};
      row.innerHTML = `
        <img src="${escapeAttr(src)}" alt="Önizleme" onerror="this.style.opacity='0.3'" onload="this.style.opacity='1'">
        <div class="image-meta">
          <label><span>Görsel Yolu/URL</span><input type="text" data-field="src" value="${escapeAttr(src)}" placeholder="/uploads/projects/... veya https://...blob.vercel-storage.com/..."></label>
          <div class="row">
            <label><span>Alt (TR)</span><input type="text" data-field="alt-tr" value="${escapeAttr(alt.tr || "")}"></label>
            <label><span>Alt (EN)</span><input type="text" data-field="alt-en" value="${escapeAttr(alt.en || "")}"></label>
          </div>
          <div data-role="image-status" class="image-status"></div>
        </div>
        <div class="image-item-actions">
          <button type="button" class="btn small secondary" data-action="move-up">Yukarı</button>
          <button type="button" class="btn small secondary" data-action="move-down">Aşağı</button>
          <button type="button" class="btn small danger" data-action="remove-image">Kaldır</button>
        </div>
      `;
      const srcInput = row.querySelector('[data-field="src"]');
      const preview = row.querySelector("img");
      if (srcInput) {
        srcInput.addEventListener("input", () => {
          if (preview) preview.src = srcInput.value.trim();
          updateImageRowStatus(row);
          updateProjectPreview();
        });
      }
      row.querySelectorAll('input[data-field="alt-tr"], input[data-field="alt-en"]').forEach((el) => {
        el.addEventListener("input", updateProjectPreview);
      });
      row.addEventListener("click", (e) => {
        const btn = e.target.closest("button[data-action]");
        if (!btn) return;
        const action = btn.getAttribute("data-action");
        if (action === "remove-image") {
          row.remove();
          updateProjectPreview();
        }
        if (action === "move-up" && row.previousElementSibling) {
          els.imageList.insertBefore(row, row.previousElementSibling);
          updateProjectPreview();
        }
        if (action === "move-down" && row.nextElementSibling) {
          els.imageList.insertBefore(row.nextElementSibling, row);
          updateProjectPreview();
        }
      });
      els.imageList.appendChild(row);
      updateImageRowStatus(row);
    }

    function setImageList(images) {
      els.imageList.innerHTML = "";
      (images || []).forEach(renderImageItem);
      if (!images || !images.length) {
        renderImageItem({ src: "", alt: { en: "", tr: "" } });
      }
      updateProjectPreview();
    }

    function collectFormData() {
      return {
        order: Number(document.getElementById("order").value),
        numberLabel: document.getElementById("numberLabel").value.trim(),
        status: document.getElementById("status").value,
        category: {
          tr: document.getElementById("category-tr").value.trim(),
          en: document.getElementById("category-en").value.trim(),
        },
        title: {
          tr: document.getElementById("title-tr").value.trim(),
          en: document.getElementById("title-en").value.trim(),
        },
        description: {
          tr: linesToArray(document.getElementById("description-tr").value),
          en: linesToArray(document.getElementById("description-en").value),
        },
        images: collectImagesFromForm(),
      };
    }

    function updateProjectPreview() {
      if (!els.projectPreview) return;
      const data = collectFormData();
      const trTitle = data.title.tr || "(TR başlık yok)";
      const enTitle = data.title.en || "(EN title missing)";
      const trCat = data.category.tr || "-";
      const enCat = data.category.en || "-";
      const trParas = data.description.tr.length;
      const enParas = data.description.en.length;
      const imgs = data.images || [];
      const brokenUploads = imgs.filter((img) => isUploadSrc(img.src) && !state.uploadSet.has(uploadFilenameFromSrc(img.src))).length;
      const thumbs = imgs.slice(0, 8).map((img) => `<img class="preview-thumb${(isUploadSrc(img.src) && !state.uploadSet.has(uploadFilenameFromSrc(img.src))) ? " broken" : ""}" src="${escapeAttr(img.src)}" alt="" onerror="this.classList.add('broken')">`).join("");
      els.projectPreview.innerHTML = `
        <h4>Canlı Önizleme Özeti</h4>
        <div><strong>TR:</strong> ${escapeAttr(trTitle)} <span class="preview-meta">(${escapeAttr(trCat)})</span></div>
        <div><strong>EN:</strong> ${escapeAttr(enTitle)} <span class="preview-meta">(${escapeAttr(enCat)})</span></div>
        <div class="preview-meta">Paragraflar: TR ${trParas} / EN ${enParas} • Görseller: ${imgs.length}${brokenUploads ? ` • Kırık upload referansı: ${brokenUploads}` : ""}</div>
        <div class="preview-gallery">${thumbs || '<span class="muted">Görsel önizlemesi yok</span>'}</div>
      `;
    }

    function resetForm() {
      state.editingId = null;
      els.form.reset();
      document.getElementById("project-id").value = "";
      document.getElementById("order").value = String(nextOrderFromProjects(state.projects));
      document.getElementById("numberLabel").value = String(nextOrderFromProjects(state.projects)).padStart(2, "0");
      document.getElementById("status").value = "published";
      setImageList([]);
      els.formTitle.textContent = "Yeni Proje";
      els.editingIdLabel.textContent = "";
      els.deleteBtn.style.display = "none";
      setStatus(els.formStatus, "", "");
      clearFieldInvalidStates();
      setFormErrors([]);
      updateProjectPreview();
    }

    function fillForm(project) {
      state.editingId = project.id;
      document.getElementById("project-id").value = project.id || "";
      document.getElementById("order").value = project.order || "";
      document.getElementById("numberLabel").value = project.numberLabel || "";
      document.getElementById("status").value = project.status || "published";
      document.getElementById("category-tr").value = project.category?.tr || "";
      document.getElementById("category-en").value = project.category?.en || "";
      document.getElementById("title-tr").value = project.title?.tr || "";
      document.getElementById("title-en").value = project.title?.en || "";
      document.getElementById("description-tr").value = arrayToLines(project.description?.tr || []);
      document.getElementById("description-en").value = arrayToLines(project.description?.en || []);
      setImageList(project.images || []);
      els.formTitle.textContent = "Projeyi Düzenle";
      els.editingIdLabel.textContent = `ID: ${project.id}`;
      els.deleteBtn.style.display = "inline-block";
      setStatus(els.formStatus, "", "");
      clearFieldInvalidStates();
      setFormErrors([]);
      updateProjectPreview();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }

    function renderProjectsTable() {
      if (!els.tableBody) return;
      const projects = state.projects;
      if (!projects.length) {
        els.tableBody.innerHTML = '<tr><td colspan="6" class="muted">Henüz proje yok.</td></tr>';
        return;
      }
      els.tableBody.innerHTML = projects.map((p, index) => {
        const statusClass = p.status === "draft" ? "draft" : "published";
        const statusLabel = p.status === "draft" ? "Taslak" : "Yayında";
        const title = (p.title && (p.title.tr || p.title.en)) || "(Başlıksız)";
        const imgCount = Array.isArray(p.images) ? p.images.length : 0;
        return `
          <tr>
            <td>${escapeAttr(p.numberLabel || p.order || "")}</td>
            <td>${escapeAttr(title)}</td>
            <td><span class="badge ${statusClass}">${statusLabel}</span></td>
            <td>${imgCount}</td>
            <td class="actions-cell">
              <button class="btn small secondary" data-action="move-row-up" data-id="${escapeAttr(p.id)}" ${index === 0 ? "disabled" : ""}>Yukarı</button>
              <button class="btn small secondary" data-action="move-row-down" data-id="${escapeAttr(p.id)}" ${index === projects.length - 1 ? "disabled" : ""}>Aşağı</button>
            </td>
            <td class="actions-cell">
              <button class="btn small secondary" data-action="edit" data-id="${escapeAttr(p.id)}">Düzenle</button>
              <button class="btn small danger" data-action="delete" data-id="${escapeAttr(p.id)}">Sil</button>
            </td>
          </tr>`;
      }).join("");
    }

    function updateUploadsSelectionStatus() {
      if (!els.uploadsSelectionStatus) return;
      const count = state.uploadSelection.size;
      els.uploadsSelectionStatus.textContent = count ? `${count} yükleme seçili` : "Seçili yükleme yok";
    }

    function getFilteredUploads() {
      const q = String(state.uploadsSearch || "").trim().toLowerCase();
      const filter = state.uploadsFilter || "all";
      return (state.uploads || []).filter((u) => {
        if (filter === "referenced" && !u.isReferenced) return false;
        if (filter === "unreferenced" && u.isReferenced) return false;
        if (!q) return true;
        return String(u.filename || "").toLowerCase().includes(q) || String(u.src || "").toLowerCase().includes(q);
      });
    }

    function renderUploadsList() {
      if (!els.uploadsList) return;
      const uploads = getFilteredUploads();
      if (!state.uploads || !state.uploads.length) {
        els.uploadsList.innerHTML = '<p class="muted">Yükleme bulunamadı.</p>';
        updateUploadsSelectionStatus();
        return;
      }
      if (!uploads.length) {
        els.uploadsList.innerHTML = '<p class="muted">Arama/filtreye uygun yükleme bulunamadı.</p>';
        updateUploadsSelectionStatus();
        return;
      }
      els.uploadsList.innerHTML = uploads.map((u) => {
        const refBadge = u.isReferenced ? `<span class="pill warn">Referans: ${u.referencedCount}</span>` : `<span class="pill ok">Kullanılmıyor</span>`;
        const mtime = u.mtime ? new Date(u.mtime).toLocaleString() : "-";
        const selected = state.uploadSelection.has(u.src);
        return `
          <div class="upload-item ${selected ? "selected" : ""}">
            <img src="${escapeAttr(u.src)}" alt="${escapeAttr(u.filename)}" onerror="this.style.opacity='0.3'">
            <div class="upload-meta">
              <div class="upload-name upload-select-wrap">
                <input type="checkbox" data-upload-action="toggle-select" data-src="${escapeAttr(u.src)}" ${selected ? "checked" : ""} aria-label="Seç ${escapeAttr(u.filename)}">
                <span>${escapeAttr(u.filename)}</span>
              </div>
              <div class="upload-sub">${escapeAttr(u.src)}</div>
              <div class="upload-sub">${escapeAttr(formatBytes(u.size))} • ${escapeAttr(mtime)}</div>
              <div>${refBadge}</div>
            </div>
            <div class="upload-actions">
              <button type="button" class="btn small secondary" data-upload-action="insert" data-src="${escapeAttr(u.src)}">Projeye Ekle</button>
              <button type="button" class="btn small danger" data-upload-action="delete" data-filename="${escapeAttr(u.filename)}" ${u.isReferenced ? "disabled title=\"Önce projelerden kaldırın\"" : ""}>Sil</button>
            </div>
          </div>`;
      }).join("");
      updateUploadsSelectionStatus();
    }

    async function loadProjects() {
      setStatus(els.pageStatus, "Projeler yükleniyor...", "");
      try {
        const data = await api("/api/admin/projects");
        state.projects = Array.isArray(data.projects) ? [...data.projects] : [];
        state.projects.sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));
        state.orderDirty = false;
        renderProjectsTable();
        setStatus(els.pageStatus, `${state.projects.length} proje yüklendi.`, "success");
        if (!state.editingId) {
          document.getElementById("order").value = String(nextOrderFromProjects(state.projects));
          document.getElementById("numberLabel").value = String(nextOrderFromProjects(state.projects)).padStart(2, "0");
        }
        updateProjectPreview();
      } catch (error) {
        if (error.status === 401) {
          window.location.href = "./admin-login.html";
          return;
        }
        setStatus(els.pageStatus, error.message || "Projeler yüklenemedi.", "error");
      }
    }

    async function loadUploads() {
      if (els.uploadsList) els.uploadsList.innerHTML = '<p class="muted">Yüklemeler yükleniyor...</p>';
      try {
        const data = await api("/api/admin/uploads");
        state.uploads = Array.isArray(data.files) ? data.files : [];
        state.uploadSet = new Set(state.uploads.map((u) => u.filename));
        const validSrcs = new Set(state.uploads.map((u) => u.src));
        state.uploadSelection = new Set(Array.from(state.uploadSelection).filter((src) => validSrcs.has(src)));
        renderUploadsList();
        getImageRows().forEach(updateImageRowStatus);
        updateProjectPreview();
      } catch (error) {
        if (error.status === 401) {
          window.location.href = "./admin-login.html";
          return;
        }
        if (els.uploadsList) els.uploadsList.innerHTML = `<p class="status error">${escapeAttr(error.message || "Yüklemeler listelenemedi.")}</p>`;
      }
    }

    async function saveProject(e) {
      e.preventDefault();
      const payload = collectFormData();
      const errors = validateFormDataClient(payload);
      applyValidationUI(errors);
      if (errors.length) {
        setStatus(els.formStatus, "Formda hatalar var. Lütfen işaretli alanları düzeltin.", "error");
        return;
      }
      if (state.orderDirty) {
        const proceed = window.confirm("Kaydedilmemiş sıralama değişiklikleri var. Önce sıralamayı kaydetmeniz önerilir. Yine de projeyi kaydetmek istiyor musunuz?");
        if (!proceed) return;
      }
      setStatus(els.formStatus, "Kaydediliyor...", "");
      const id = state.editingId || document.getElementById("project-id").value.trim();
      try {
        if (id) {
          await api(`/api/admin/projects/${encodeURIComponent(id)}`, {
            method: "PUT",
            body: JSON.stringify(payload),
          });
          setStatus(els.formStatus, "Proje güncellendi.", "success");
        } else {
          const data = await api("/api/admin/projects", {
            method: "POST",
            body: JSON.stringify(payload),
          });
          state.editingId = data.project && data.project.id;
          setStatus(els.formStatus, "Proje oluşturuldu.", "success");
        }
        await loadProjects();
        await loadUploads();
        if (state.editingId) {
          const current = state.projects.find((p) => p.id === state.editingId);
          if (current) fillForm(current); else resetForm();
        } else {
          resetForm();
        }
      } catch (error) {
        setStatus(els.formStatus, error.message || "Kaydetme başarısız.", "error");
      }
    }

    async function deleteProjectById(id) {
      if (!id) return;
      if (!window.confirm("Bu projeyi silmek istediğinize emin misiniz?")) return;
      setStatus(els.formStatus, "Proje siliniyor...", "");
      try {
        await api(`/api/admin/projects/${encodeURIComponent(id)}`, { method: "DELETE" });
        setStatus(els.formStatus, "Proje silindi.", "success");
        resetForm();
        await loadProjects();
        await loadUploads();
      } catch (error) {
        setStatus(els.formStatus, error.message || "Silme başarısız.", "error");
      }
    }

    async function uploadImages() {
      const files = Array.from(els.uploadInput.files || []);
      if (!files.length) {
        setStatus(els.formStatus, "Yüklenecek görsel seçin.", "error");
        return;
      }
      setStatus(els.formStatus, "Görseller yükleniyor...", "");
      const formData = new FormData();
      files.forEach((file) => formData.append("images", file));
      try {
        const data = await api("/api/admin/uploads", { method: "POST", body: formData });
        const uploaded = Array.isArray(data.files) ? data.files : [];
        uploaded.forEach((file) => renderImageItem({ src: file.src, alt: { en: "", tr: "" } }));
        els.uploadInput.value = "";
        setStatus(els.formStatus, `${uploaded.length} görsel yüklendi ve listeye eklendi.`, "success");
        await loadUploads();
        updateProjectPreview();
      } catch (error) {
        setStatus(els.formStatus, error.message || "Görsel yükleme başarısız.", "error");
      }
    }

    function moveProjectRow(id, direction) {
      const index = state.projects.findIndex((p) => p.id === id);
      if (index === -1) return;
      const target = direction === "up" ? index - 1 : index + 1;
      if (target < 0 || target >= state.projects.length) return;
      const [item] = state.projects.splice(index, 1);
      state.projects.splice(target, 0, item);
      syncOrderLabelsFromState();
      state.orderDirty = true;
      renderProjectsTable();
      if (!state.editingId) {
        document.getElementById("order").value = String(nextOrderFromProjects(state.projects));
        document.getElementById("numberLabel").value = String(nextOrderFromProjects(state.projects)).padStart(2, "0");
      }
      setStatus(els.pageStatus, "Sıralama değişti. Kalıcı yapmak için 'Sıralamayı Kaydet' butonuna basın.", "success");
    }

    async function saveOrder() {
      if (!state.projects.length) return;
      if (!state.orderDirty) {
        setStatus(els.pageStatus, "Kaydedilecek sıralama değişikliği yok.", "success");
        return;
      }
      setStatus(els.pageStatus, "Sıralama kaydediliyor...", "");
      try {
        syncOrderLabelsFromState();
        const items = state.projects.map((p) => ({ id: p.id }));
        const data = await api("/api/admin/projects/reorder", {
          method: "POST",
          body: JSON.stringify({ items }),
        });
        if (data && Array.isArray(data.projects)) {
          state.projects = [...data.projects].sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));
        }
        state.orderDirty = false;
        renderProjectsTable();
        setStatus(els.pageStatus, "Sıralama kaydedildi.", "success");
        await loadProjects();
      } catch (error) {
        setStatus(els.pageStatus, error.message || "Sıralama kaydedilemedi.", "error");
      }
    }

    async function cleanupOrphanUploads() {
      if (!window.confirm("Kullanılmayan (hiçbir projede referans edilmeyen) yüklenmiş görseller silinsin mi?")) return;
      setStatus(els.pageStatus, "Yetim yükleme temizliği yapılıyor...", "");
      try {
        const data = await api("/api/admin/uploads/cleanup", { method: "POST", body: JSON.stringify({}) });
        const removed = data.removed || 0;
        const scanned = data.scanned || 0;
        setStatus(els.pageStatus, `Temizlik tamamlandı. Taranan: ${scanned}, silinen: ${removed}.`, "success");
        await loadUploads();
      } catch (error) {
        setStatus(els.pageStatus, error.message || "Temizlik başarısız.", "error");
      }
    }

    async function cleanupBrokenImageReferences() {
      if (!window.confirm("Projelerdeki eksik yükleme dosyalarına ait kırık görsel referansları temizlemek istiyor musunuz?")) return;
      setStatus(els.pageStatus, "Kırık görsel referansları temizleniyor...", "");
      try {
        const data = await api("/api/admin/projects/cleanup-image-references", { method: "POST", body: JSON.stringify({}) });
        setStatus(els.pageStatus, `Referans temizliği tamamlandı. Etkilenen proje: ${data.affectedProjects || 0}, kaldırılan referans: ${data.removedReferences || 0}.`, "success");
        const editingId = state.editingId;
        await loadProjects();
        await loadUploads();
        if (editingId) {
          const current = state.projects.find((p) => p.id === editingId);
          if (current) fillForm(current);
          else resetForm();
        }
      } catch (error) {
        setStatus(els.pageStatus, error.message || "Referans temizliği başarısız.", "error");
      }
    }

    async function deleteUploadFile(filename) {
      if (!filename) return;
      if (!window.confirm(`"${filename}" dosyasını silmek istiyor musunuz?`)) return;
      try {
        await api(`/api/admin/uploads/${encodeURIComponent(filename)}`, { method: "DELETE" });
        setStatus(els.pageStatus, `"${filename}" silindi.`, "success");
        await loadUploads();
      } catch (error) {
        setStatus(els.pageStatus, error.message || "Yükleme silinemedi.", "error");
      }
    }

    async function ensureAuth() {
      try {
        const data = await api("/api/admin/me");
        if (data && data.csrfToken) csrfTokenCache = data.csrfToken;
        return true;
      } catch (_error) {
        window.location.href = "./admin-login.html";
        return false;
      }
    }

    // Events
    els.form.addEventListener("submit", saveProject);
    els.newBtn.addEventListener("click", resetForm);
    els.refreshBtn.addEventListener("click", async () => { await loadProjects(); await loadUploads(); });
    els.resetBtn.addEventListener("click", resetForm);
    els.addImageRowBtn.addEventListener("click", () => { renderImageItem({ src: "", alt: { en: "", tr: "" } }); updateProjectPreview(); });
    els.uploadBtn.addEventListener("click", uploadImages);
    els.deleteBtn.addEventListener("click", () => deleteProjectById(state.editingId));
    if (els.saveOrderBtn) els.saveOrderBtn.addEventListener("click", saveOrder);
    if (els.cleanupUploadsBtn) els.cleanupUploadsBtn.addEventListener("click", cleanupOrphanUploads);
    if (els.refreshUploadsBtn) els.refreshUploadsBtn.addEventListener("click", loadUploads);
    if (els.cleanupBrokenRefsBtn) els.cleanupBrokenRefsBtn.addEventListener("click", cleanupBrokenImageReferences);
    els.logoutBtn.addEventListener("click", async () => {
      try { await api("/api/admin/logout", { method: "POST", body: JSON.stringify({}) }); } catch (_e) {}
      csrfTokenCache = null;
      window.location.href = "./admin-login.html";
    });

    els.tableBody.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-action]");
      if (!btn) return;
      const id = btn.getAttribute("data-id");
      const action = btn.getAttribute("data-action");
      const project = state.projects.find((p) => p.id === id);
      if (action === "edit" && project) fillForm(project);
      if (action === "delete") deleteProjectById(id);
      if (action === "move-row-up") moveProjectRow(id, "up");
      if (action === "move-row-down") moveProjectRow(id, "down");
    });

    if (els.uploadsList) {
      els.uploadsList.addEventListener("click", (e) => {
        const btn = e.target.closest("button[data-upload-action]");
        if (!btn) return;
        const action = btn.getAttribute("data-upload-action");
        if (action === "insert") {
          const src = btn.getAttribute("data-src") || "";
          if (!src) return;
          renderImageItem({ src, alt: { en: "", tr: "" } });
          updateProjectPreview();
          setStatus(els.formStatus, "Görsel proje formuna eklendi. Kaydetmeyi unutmayın.", "success");
        }
        if (action === "delete") {
          const filename = btn.getAttribute("data-filename") || "";
          deleteUploadFile(filename);
        }
      });
      els.uploadsList.addEventListener("change", (e) => {
        const input = e.target.closest('input[data-upload-action="toggle-select"]');
        if (!input) return;
        const src = input.getAttribute("data-src") || "";
        if (!src) return;
        if (input.checked) state.uploadSelection.add(src);
        else state.uploadSelection.delete(src);
        const item = input.closest(".upload-item");
        if (item) item.classList.toggle("selected", input.checked);
        updateUploadsSelectionStatus();
      });
    }

    if (els.uploadsSearch) {
      els.uploadsSearch.addEventListener("input", () => {
        state.uploadsSearch = els.uploadsSearch.value || "";
        renderUploadsList();
      });
    }
    if (els.uploadsFilter) {
      els.uploadsFilter.addEventListener("change", () => {
        state.uploadsFilter = els.uploadsFilter.value || "all";
        renderUploadsList();
      });
    }
    if (els.selectAllUploadsBtn) {
      els.selectAllUploadsBtn.addEventListener("click", () => {
        getFilteredUploads().forEach((u) => state.uploadSelection.add(u.src));
        renderUploadsList();
      });
    }
    if (els.clearUploadSelectionBtn) {
      els.clearUploadSelectionBtn.addEventListener("click", () => {
        state.uploadSelection.clear();
        renderUploadsList();
      });
    }
    if (els.addSelectedUploadsBtn) {
      els.addSelectedUploadsBtn.addEventListener("click", () => {
        const selectedSrcs = getFilteredUploads()
          .map((u) => u.src)
          .filter((src) => state.uploadSelection.has(src));
        if (!selectedSrcs.length) {
          setStatus(els.formStatus, "Projeye eklemek için en az bir yükleme seçin.", "error");
          return;
        }
        selectedSrcs.forEach((src) => renderImageItem({ src, alt: { en: "", tr: "" } }));
        updateProjectPreview();
        setStatus(els.formStatus, `${selectedSrcs.length} seçili görsel proje formuna eklendi. Kaydetmeyi unutmayın.`, "success");
      });
    }

    document.querySelectorAll('[data-lang-tab]').forEach((btn) => {
      btn.addEventListener("click", () => {
        setContentLangTab(btn.getAttribute("data-lang-tab"));
      });
    });

    if (els.form) {
      els.form.addEventListener("input", (e) => {
        if (e.target && e.target.id && e.target.classList.contains("invalid")) {
          e.target.classList.remove("invalid");
        }
        if (els.formErrors && els.formErrors.classList.contains("visible")) {
          setFormErrors([]);
        }
        updateProjectPreview();
      });
      els.form.addEventListener("change", updateProjectPreview);
    }

    (async () => {
      const ok = await ensureAuth();
      if (!ok) return;
      resetForm();
      await loadProjects();
      await loadUploads();
    })();
  }

  window.AdminApp = { initLoginPage, initProjectsPage };
})();
