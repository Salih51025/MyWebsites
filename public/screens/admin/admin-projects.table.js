(function () {
  window.AdminApp = window.AdminApp || {};
  window.AdminApp.projectsTable = {
    create(ctx, form) {
      const { state, els, core } = ctx;
      const { api, escapeAttr, nextOrderFromProjects, setStatus } = core;

      function syncOrderLabelsFromState() {
        state.projects.forEach((p, i) => {
          p.order = i + 1;
          p.numberLabel = String(i + 1).padStart(2, "0");
        });
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
          form.updateProjectPreview();
        } catch (error) {
          if (error.status === 401) {
            window.location.href = "./admin-login.html";
            return;
          }
          setStatus(els.pageStatus, error.message || "Projeler yüklenemedi.", "error");
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

      function bindEvents(actions) {
        els.tableBody.addEventListener("click", (e) => {
          const btn = e.target.closest("button[data-action]");
          if (!btn) return;
          const id = btn.getAttribute("data-id");
          const action = btn.getAttribute("data-action");
          const project = state.projects.find((p) => p.id === id);
          if (action === "edit" && project) form.fillForm(project);
          if (action === "delete") actions.deleteProjectById(id);
          if (action === "move-row-up") moveProjectRow(id, "up");
          if (action === "move-row-down") moveProjectRow(id, "down");
        });
        if (els.saveOrderBtn) els.saveOrderBtn.addEventListener("click", saveOrder);
      }

      return {
        bindEvents,
        loadProjects,
        moveProjectRow,
        renderProjectsTable,
        saveOrder,
        syncOrderLabelsFromState,
      };
    },
  };
})();
