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

  function renderProjects(projects) {
    const container = document.getElementById(LIST_ID);
    if (!container) return;

    const lang = getLang();
    container.innerHTML = "";

    if (!Array.isArray(projects) || projects.length === 0) {
      const empty = createEl("p", "projects-empty", lang === "tr" ? "Henüz proje eklenmedi." : "No projects added yet.");
      container.appendChild(empty);
      return;
    }

    projects.forEach((project) => {
      const article = createEl("article", "project-card");

      const header = createEl("div", "project-header");
      const number = createEl("span", "project-number", project.numberLabel || String(project.order || "").padStart(2, "0") || "");
      const titleWrap = createEl("div", "project-title");
      const category = createEl("span", "project-category", pickLocalized(project.category, lang));
      const title = createEl("h2", null, pickLocalized(project.title, lang));
      titleWrap.appendChild(category);
      titleWrap.appendChild(title);
      header.appendChild(number);
      header.appendChild(titleWrap);

      const gallery = createEl("div", "project-gallery");
      const images = Array.isArray(project.images) ? project.images : [];
      images.forEach((img) => {
        const imgWrap = createEl("div", "project-image");
        const imageEl = document.createElement("img");
        imageEl.src = typeof img === "string" ? img : (img && img.src) || "";
        const altObj = img && img.alt && typeof img.alt === "object" ? img.alt : null;
        imageEl.alt = altObj ? (altObj[lang] || altObj.en || altObj.tr || pickLocalized(project.title, lang) || "Project image") : (pickLocalized(project.title, lang) || "Project image");
        imageEl.loading = "lazy";
        imgWrap.appendChild(imageEl);
        gallery.appendChild(imgWrap);
      });

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
      container.appendChild(article);
    });
  }

  let cachedProjects = [];

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
      // Fallback: try to render nothing with a friendly message
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
