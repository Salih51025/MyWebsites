(function () {
  window.ProjectsUI = window.ProjectsUI || {};

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

  function buildCompactCard(project, lang, index, onActivate) {
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

  window.ProjectsUI.cards = {
    buildCompactCard,
    buildDetailCard,
    buildGallery,
    createEl,
    getLang,
    pickLocalized,
    pickLocalizedList,
  };
})();
