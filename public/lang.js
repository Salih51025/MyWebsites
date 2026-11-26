(function () {
    const STORAGE_KEY = "site-lang";
    const DEFAULT_LANG = "en";

    // Translation data is loaded from lang.translations.js to keep this engine small.
    const translations = window.SITE_TRANSLATIONS || { en: {}, tr: {} };

    function getCurrentLang() {
        const saved = localStorage.getItem(STORAGE_KEY);
        return saved === "tr" || saved === "en" ? saved : DEFAULT_LANG;
    }

    function t(key) {
        const lang = getCurrentLang();
        return (translations[lang] && translations[lang][key]) || (translations.en && translations.en[key]) || "";
    }

    function applyTranslations(root) {
        const scope = root || document;
        const lang = getCurrentLang();
        document.documentElement.lang = lang;
        document.documentElement.setAttribute("data-lang", lang);

        scope.querySelectorAll("[data-i18n]").forEach((el) => {
            const key = el.getAttribute("data-i18n");
            const value = t(key);
            if (value) el.textContent = value;
        });

        scope.querySelectorAll("[data-i18n-html]").forEach((el) => {
            const key = el.getAttribute("data-i18n-html");
            const value = t(key);
            if (value) el.innerHTML = value;
        });

        scope.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
            const key = el.getAttribute("data-i18n-placeholder");
            const value = t(key);
            if (value) el.setAttribute("placeholder", value);
        });

        scope.querySelectorAll("[data-i18n-aria-label]").forEach((el) => {
            const key = el.getAttribute("data-i18n-aria-label");
            const value = t(key);
            if (value) el.setAttribute("aria-label", value);
        });

        const titleEl = document.querySelector("title[data-i18n-title]");
        if (titleEl) {
            const key = titleEl.getAttribute("data-i18n-title");
            const value = t(key);
            if (value) titleEl.textContent = value;
        }

        updateLangToggleUI();
    }

    function updateLangToggleUI() {
        const lang = getCurrentLang();
        document.querySelectorAll("[data-lang-switch]").forEach((btn) => {
            const value = btn.getAttribute("data-lang-switch");
            const active = value === lang;
            btn.classList.toggle("active", active);
            btn.setAttribute("aria-pressed", String(active));
        });
    }

    function setLanguage(lang) {
        if (lang !== "en" && lang !== "tr") return;
        localStorage.setItem(STORAGE_KEY, lang);
        applyTranslations(document);
        document.dispatchEvent(new CustomEvent("site:languagechange", { detail: { lang } }));
    }

    function initLanguageSwitcher() {
        document.addEventListener("click", (event) => {
            const btn = event.target.closest("[data-lang-switch]");
            if (!btn) return;
            event.preventDefault();
            setLanguage(btn.getAttribute("data-lang-switch"));
        });
    }

    window.siteI18n = {
        t,
        applyTranslations,
        setLanguage,
        getCurrentLang
    };

    function init() {
        initLanguageSwitcher();
        applyTranslations(document);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();