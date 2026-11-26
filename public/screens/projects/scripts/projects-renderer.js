(function () {
  const LIST_ID = "projects-list";
  const cards = window.ProjectsUI && window.ProjectsUI.cards;
  if (!cards) {
    console.error("ProjectsUI.cards yüklenemedi.");
    return;
  }

  const { buildCompactCard, buildDetailCard, createEl, getLang } = cards;

  function renderProjects(projects) {
    const container = document.getElementById(LIST_ID);
    if (!container) return;

    const lang = getLang();
    container.innerHTML = "";
    container.classList.add("projects-list--grid");

    if (!Array.isArray(projects) || projects.length === 0) {
      const empty = createEl("p", "projects-empty", lang === "tr" ? "Henüz proje eklenmedi." : "No projects added yet.");
      container.appendChild(empty);
      return;
    }

    const layout = createEl("div", "projects-layout");
    const grid = createEl("div", "projects-grid");
    const detailPanel = createEl("div", "project-detail-panel");
    detailPanel.setAttribute("aria-live", "polite");

    let activeIndex = -1;
    let hideTimer = null;

    function clearHideTimer() {
      if (hideTimer) {
        window.clearTimeout(hideTimer);
        hideTimer = null;
      }
    }

    let closeTimer = null;
    let ignoreMouseLeaveUntil = 0;

    function closeDetail(immediate = false) {
      clearHideTimer();
      if (closeTimer) {
        window.clearTimeout(closeTimer);
        closeTimer = null;
      }
      const wasActive = activeIndex !== -1 || detailPanel.classList.contains("is-visible");
      activeIndex = -1;
      grid.querySelectorAll(".project-compact").forEach((el) => el.classList.remove("is-active"));
      detailPanel.classList.remove("is-visible");
      if (!wasActive || immediate) {
        detailPanel.innerHTML = "";
        return;
      }
      closeTimer = window.setTimeout(() => {
        if (!detailPanel.classList.contains("is-visible")) {
          detailPanel.innerHTML = "";
        }
        closeTimer = null;
      }, 920);
    }

    function setActive(index) {
      clearHideTimer();
      if (closeTimer) {
        window.clearTimeout(closeTimer);
        closeTimer = null;
      }
      if (index < 0 || index >= projects.length) return;
      if (activeIndex === index) {
        closeDetail();
        return;
      }
      const cards = grid.querySelectorAll(".project-compact");
      const activeCard = cards[index];
      if (activeCard) {
        const gridRect = grid.getBoundingClientRect();
        const cardRect = activeCard.getBoundingClientRect();
        const x = cardRect.left - gridRect.left + cardRect.width / 2;
        const w = cardRect.width;
        detailPanel.style.setProperty("--flow-x", `${x}px`);
        detailPanel.style.setProperty("--flow-w", `${w}px`);
      }
      activeIndex = index;
      cards.forEach((el, i) => {
        el.classList.toggle("is-active", i === index);
      });
      detailPanel.innerHTML = "";
      const detail = buildDetailCard(projects[index], lang);
      detailPanel.appendChild(detail);
      detailPanel.classList.remove("is-visible");
      // restart flow animation
      void detailPanel.offsetWidth;
      detailPanel.classList.add("is-visible");
      ignoreMouseLeaveUntil = Date.now() + 900;
      window.requestAnimationFrame(() => {
        detailPanel.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }

    function scheduleHide(index) {
      clearHideTimer();
      hideTimer = window.setTimeout(() => {
        if (activeIndex === index) {
          // keep open if pointer moved into detail panel; mouseleave handler handles final hide
        }
      }, 120);
    }

    projects.forEach((project, index) => {
      grid.appendChild(buildCompactCard(project, lang, index, setActive, scheduleHide));
    });

    if (outsideClickHandler) {
      document.removeEventListener("click", outsideClickHandler);
    }
    outsideClickHandler = (event) => {
      if (!layout.contains(event.target)) {
        closeDetail();
      }
    };
    document.addEventListener("click", outsideClickHandler);

    layout.addEventListener("mouseleave", () => {
      if (Date.now() < ignoreMouseLeaveUntil) return;
      closeDetail();
    });

    layout.appendChild(grid);
    layout.appendChild(detailPanel);
    container.appendChild(layout);
  }

  let cachedProjects = [];
  let outsideClickHandler = null;

  async function loadAndRenderProjects() {
    const container = document.getElementById(LIST_ID);
    if (!container) return;

    try {
      const response = await fetch("/api/projects", { headers: { "Accept": "application/json" } });
      if (!response.ok) throw new Error("Projects request failed");
      const data = await response.json();
      cachedProjects = Array.isArray(data.projects) ? data.projects : [];
      renderProjects(cachedProjects);
    } catch (error) {
      console.error("Projeler yüklenemedi:", error);
      const lang = getLang();
      container.innerHTML = "";
      const msg = createEl("p", "projects-empty", lang === "tr" ? "Projeler şu anda yüklenemedi." : "Projects could not be loaded right now.");
      container.appendChild(msg);
    }
  }

  document.addEventListener("site:languagechange", function () {
    if (cachedProjects.length) {
      renderProjects(cachedProjects);
    } else {
      loadAndRenderProjects();
    }
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", loadAndRenderProjects);
  } else {
    loadAndRenderProjects();
  }
})();