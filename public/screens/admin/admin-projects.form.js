(function () {
  window.AdminApp = window.AdminApp || {};
  window.AdminApp.projectsForm = {
    create(ctx) {
      const { state, els, core } = ctx;
      const { arrayToLines, escapeAttr, linesToArray, nextOrderFromProjects } = core;

      function isUploadSrc(src) {
        return typeof src === "string" && src.startsWith("/uploads/projects/");
      }

      function uploadFilenameFromSrc(src) {
        if (!isUploadSrc(src)) return null;
        const parts = src.split("/");
        return parts[parts.length - 1] || null;
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

      function setContentLangTab(lang) {
        const target = lang === "en" ? "en" : "tr";
        document.querySelectorAll("[data-lang-tab]").forEach((btn) => {
          const active = btn.getAttribute("data-lang-tab") === target;
          btn.classList.toggle("active", active);
          btn.setAttribute("aria-selected", String(active));
        });
        document.querySelectorAll("[data-lang-panel]").forEach((panel) => {
          panel.classList.toggle("active", panel.getAttribute("data-lang-panel") === target);
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

      function renderImageItem(image) {
        const row = document.createElement("div");
        row.className = "image-item";
        const src = image && image.src ? image.src : "";
        const alt = image && image.alt ? image.alt : {};
        row.innerHTML = `
          <img src="${escapeAttr(src)}" alt="Önizleme" onerror="this.style.opacity='0.3'" onload="this.style.opacity='1'">
          <div class="image-meta">
            <label><span>Görsel Yolu/URL</span><input type="text" data-field="src" value="${escapeAttr(src)}" placeholder="/uploads/projects/... veya ../../images/..."></label>
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
        core.setStatus(els.formStatus, "", "");
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
        core.setStatus(els.formStatus, "", "");
        clearFieldInvalidStates();
        setFormErrors([]);
        updateProjectPreview();
        window.scrollTo({ top: 0, behavior: "smooth" });
      }

      return {
        applyValidationUI,
        clearFieldInvalidStates,
        collectFormData,
        fillForm,
        getImageRows,
        isUploadSrc,
        renderImageItem,
        resetForm,
        setContentLangTab,
        setFormErrors,
        setImageList,
        updateImageRowStatus,
        updateProjectPreview,
        uploadFilenameFromSrc,
        validateFormDataClient,
      };
    },
  };
})();
