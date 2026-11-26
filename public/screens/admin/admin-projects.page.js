(function () {
  window.AdminApp = window.AdminApp || {};
  const core = window.AdminApp.core;
  const { api, setCsrfToken, setStatus } = core;

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

    const ctx = { state, els, core, loadProjects: async () => {} };
    const form = window.AdminApp.projectsForm.create(ctx);
    const uploads = window.AdminApp.projectsUploads.create(ctx, form);
    const table = window.AdminApp.projectsTable.create(ctx, form);
    ctx.loadProjects = table.loadProjects;

    async function saveProject(e) {
      e.preventDefault();
      const payload = form.collectFormData();
      const errors = form.validateFormDataClient(payload);
      form.applyValidationUI(errors);
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
        await table.loadProjects();
        await uploads.loadUploads();
        if (state.editingId) {
          const current = state.projects.find((p) => p.id === state.editingId);
          if (current) form.fillForm(current); else form.resetForm();
        } else {
          form.resetForm();
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
        form.resetForm();
        await table.loadProjects();
        await uploads.loadUploads();
      } catch (error) {
        setStatus(els.formStatus, error.message || "Silme başarısız.", "error");
      }
    }

    async function ensureAuth() {
      try {
        const data = await api("/api/admin/me");
        if (data && data.csrfToken) setCsrfToken(data.csrfToken);
        return true;
      } catch (_error) {
        window.location.href = "./admin-login.html";
        return false;
      }
    }

    // Event bindings
    els.form.addEventListener("submit", saveProject);
    els.newBtn.addEventListener("click", form.resetForm);
    els.refreshBtn.addEventListener("click", async () => { await table.loadProjects(); await uploads.loadUploads(); });
    els.resetBtn.addEventListener("click", form.resetForm);
    els.addImageRowBtn.addEventListener("click", () => { form.renderImageItem({ src: "", alt: { en: "", tr: "" } }); form.updateProjectPreview(); });
    els.deleteBtn.addEventListener("click", () => deleteProjectById(state.editingId));
    els.logoutBtn.addEventListener("click", async () => {
      try { await api("/api/admin/logout", { method: "POST", body: JSON.stringify({}) }); } catch (_e) {}
      setCsrfToken(null);
      window.location.href = "./admin-login.html";
    });

    table.bindEvents({ deleteProjectById });
    uploads.bindEvents();

    document.querySelectorAll("[data-lang-tab]").forEach((btn) => {
      btn.addEventListener("click", () => {
        form.setContentLangTab(btn.getAttribute("data-lang-tab"));
      });
    });

    if (els.form) {
      els.form.addEventListener("input", (e) => {
        if (e.target && e.target.id && e.target.classList.contains("invalid")) {
          e.target.classList.remove("invalid");
        }
        if (els.formErrors && els.formErrors.classList.contains("visible")) {
          form.setFormErrors([]);
        }
        form.updateProjectPreview();
      });
      els.form.addEventListener("change", form.updateProjectPreview);
    }

    (async () => {
      const ok = await ensureAuth();
      if (!ok) return;
      form.resetForm();
      await table.loadProjects();
      await uploads.loadUploads();
    })();
  }

  initProjectsPage.__split = true;
  window.AdminApp.initProjectsPage = initProjectsPage;
})();
