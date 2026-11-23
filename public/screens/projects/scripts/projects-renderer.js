(function () {
  const LIST_ID = "projects-list";

  function getLang() {
    if (window.siteI18n && typeof window.siteI18n.getCurrentLang === "function") {
      return window.siteI18n.getCurrentLang();
    }
    return document.documentElement.lang === "tr" ? "tr" : "en";
  }

  function pickLocalized(value, lang) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return value[lang] || value.en || value.tr || "";
    }
    return typeof value === "string" ? value : "";
  }

  function pickLocalizedList(value, lang) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const list = value[lang] || value.en || value.tr || [];
      return Array.isArray(list) ? list : [];
    }
    return Array.isArray(value) ? value : [];
  }

  function createEl(tag, className, text) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (typeof text === "string") el.textContent = text;
    return el;
  }

  function buildGallery(project, lang) {
    const gallery = createEl("div", "project-gallery");
    const images = Array.isArray(project.images) ? project.images : [];
    gallery.style.setProperty("--stack-count", String(images.length || 1));
    images.forEach((img) => {
      const imgWrap = createEl("div", "project-image");
      const imageEl = document.createElement("img");
      imageEl.src = typeof img === "string" ? img : (img && img.src) || "";
      const altObj = img && img.alt && typeof img.alt === "object" ? img.alt : null;
      imageEl.alt = altObj
        ? (altObj[lang] || altObj.en || altObj.tr || pickLocalized(project.title, lang) || "Project image")
        : (pickLocalized(project.title, lang) || "Project image");
      imageEl.loading = "lazy";
      imgWrap.appendChild(imageEl);
      gallery.appendChild(imgWrap);
    });
    const spacer = createEl("div", "project-gallery__spacer");
    spacer.setAttribute("aria-hidden", "true");
    gallery.appendChild(spacer);
    return gallery;
  }

  function buildDetailCard(project, lang) {
    const article = createEl("article", "project-card project-detail-card is-open");

    const header = createEl("div", "project-header");
    const number = createEl("span", "project-number", project.numberLabel || String(project.order || "").padStart(2, "0") || "");
    const titleWrap = createEl("div", "project-title");
    const category = createEl("span", "project-category", pickLocalized(project.category, lang));
    const title = createEl("h2", null, pickLocalized(project.title, lang));
    titleWrap.appendChild(category);
    titleWrap.appendChild(title);
    header.appendChild(number);
    header.appendChild(titleWrap);

    const gallery = buildGallery(project, lang);

    const description = createEl("div", "project-description");
    const paragraphs = pickLocalizedList(project.description, lang);
    paragraphs.forEach((text) => {
      const p = document.createElement("p");
      p.textContent = text;
      description.appendChild(p);
    });

    article.appendChild(header);
    article.appendChild(gallery);
    article.appendChild(description);
    return article;
  }

  function buildCompactCard(project, lang, index, onActivate, onDeactivate) {
    const button = createEl("button", "project-compact");
    button.type = "button";
    button.dataset.projectIndex = String(index);
    button.setAttribute("aria-label", pickLocalized(project.title, lang) || "Project");

    const title = createEl("span", "project-compact__title", pickLocalized(project.title, lang));
    const preview = createEl("div", "project-compact__preview");

    const gallery = buildGallery(project, lang);
    gallery.classList.add("project-gallery--compact");
    preview.appendChild(gallery);
    button.appendChild(preview);
    button.appendChild(title);

    button.addEventListener("click", () => onActivate(index));

    return button;
  }

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