(function () {
  window.AdminApp = window.AdminApp || {};
  window.AdminApp.projectsUploads = {
    create(ctx, form) {
      const { state, els, core } = ctx;
      const { api, escapeAttr, formatBytes, setStatus } = core;

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

      async function loadUploads() {
        if (els.uploadsList) els.uploadsList.innerHTML = '<p class="muted">Yüklemeler yükleniyor...</p>';
        try {
          const data = await api("/api/admin/uploads");
          state.uploads = Array.isArray(data.files) ? data.files : [];
          state.uploadSet = new Set(state.uploads.map((u) => u.filename));
          const validSrcs = new Set(state.uploads.map((u) => u.src));
          state.uploadSelection = new Set(Array.from(state.uploadSelection).filter((src) => validSrcs.has(src)));
          renderUploadsList();
          form.getImageRows().forEach(form.updateImageRowStatus);
          form.updateProjectPreview();
        } catch (error) {
          if (error.status === 401) {
            window.location.href = "./admin-login.html";
            return;
          }
          if (els.uploadsList) els.uploadsList.innerHTML = `<p class="status error">${escapeAttr(error.message || "Yüklemeler listelenemedi.")}</p>`;
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
          uploaded.forEach((file) => form.renderImageItem({ src: file.src, alt: { en: "", tr: "" } }));
          els.uploadInput.value = "";
          setStatus(els.formStatus, `${uploaded.length} görsel yüklendi ve listeye eklendi.`, "success");
          await loadUploads();
          form.updateProjectPreview();
        } catch (error) {
          setStatus(els.formStatus, error.message || "Görsel yükleme başarısız.", "error");
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
          await ctx.loadProjects();
          await loadUploads();
          if (editingId) {
            const current = state.projects.find((p) => p.id === editingId);
            if (current) form.fillForm(current);
            else form.resetForm();
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

      function bindEvents() {
        if (els.uploadsList) {
          els.uploadsList.addEventListener("click", (e) => {
            const btn = e.target.closest("button[data-upload-action]");
            if (!btn) return;
            const action = btn.getAttribute("data-upload-action");
            if (action === "insert") {
              const src = btn.getAttribute("data-src") || "";
              if (!src) return;
              form.renderImageItem({ src, alt: { en: "", tr: "" } });
              form.updateProjectPreview();
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
            selectedSrcs.forEach((src) => form.renderImageItem({ src, alt: { en: "", tr: "" } }));
            form.updateProjectPreview();
            setStatus(els.formStatus, `${selectedSrcs.length} seçili görsel proje formuna eklendi. Kaydetmeyi unutmayın.`, "success");
          });
        }
        if (els.uploadBtn) els.uploadBtn.addEventListener("click", uploadImages);
        if (els.cleanupUploadsBtn) els.cleanupUploadsBtn.addEventListener("click", cleanupOrphanUploads);
        if (els.refreshUploadsBtn) els.refreshUploadsBtn.addEventListener("click", loadUploads);
        if (els.cleanupBrokenRefsBtn) els.cleanupBrokenRefsBtn.addEventListener("click", cleanupBrokenImageReferences);
      }

      return {
        bindEvents,
        cleanupBrokenImageReferences,
        cleanupOrphanUploads,
        deleteUploadFile,
        getFilteredUploads,
        loadUploads,
        renderUploadsList,
        updateUploadsSelectionStatus,
        uploadImages,
      };
    },
  };
})();
