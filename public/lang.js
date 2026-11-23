(function () {
    const STORAGE_KEY = "site-lang";
    const DEFAULT_LANG = "en";

    const translations = {
        en: {
            "nav.home": "Home",
            "nav.projects": "Projects",
            "nav.contact": "Contact",
            "nav.menu.open": "Open navigation",

            "title.landing": "My Portfolio",
            "title.home": "My Personal Website",
            "title.projects": "Projects | Salih",
            "title.contact": "Contact | Salih",

            "landing.label": "SYSTEM INTERFACE",
            "landing.welcome": "WELCOME",
            "landing.subtitle": "TO MY WEBSITE",
            "landing.enter": "Tap to initialize",
            "landing.status.right1": "PORTFOLIO NODE",
            "landing.status.right2": "ACCESS: READY",
            "landing.status.left1": "SYS: ONLINE",

            "home.hi": "Hi it's <span>Salih</span>",
            "home.im": "I'm a <span></span>",
            "home.description": "Software developer passionate about creating modern, scalable, and user-focused applications. My main focus is mobile development with Flutter and Dart, while I’m expanding my expertise into backend development and full-stack technologies. I believe in learning by building and turning real-world problems into practical software solutions.",
            "home.download": "Download My Resume",
            "home.services.label": "ABOUT ME",
            "home.services.title": "Solutions We Can Build Together",
            "home.services.description": "I build modern, user-focused, and scalable digital products. Choose one of the service cards below to go to the contact form, where a service-specific message will be prefilled for you to edit and send.",
            "home.service.web.tag": "WEB",
            "home.service.web.title": "Website Development",
            "home.service.web.desc": "High-performance, responsive websites for corporate, portfolio, and modern web interface needs.",
            "home.service.mobile.tag": "MOBILE",
            "home.service.mobile.title": "Mobile App Development (iOS & Android)",
            "home.service.mobile.desc": "User-focused and scalable mobile app development for iOS and Android with Flutter.",
            "home.service.uiux.tag": "UI / UX",
            "home.service.uiux.title": "UI & UX Design",
            "home.service.uiux.desc": "Modern, consistent, and engaging interface design to improve product experience.",
            "home.service.custom.tag": "CUSTOM",
            "home.service.custom.title": "Custom Software Solutions",
            "home.service.custom.desc": "End-to-end development support for tailored software, automation, and digital product ideas.",
            "home.service.cta": "Contact Me",

            "projects.label": "MY WORK",
            "projects.title": "Projects",
            "projects.intro": "A selection of projects I've developed using modern technologies and creative problem-solving.",

            "contact.label": "COMMUNICATION CHANNEL",
            "contact.title": "Contact",
            "contact.subtitle": "Send a message to initiate contact.",
            "contact.placeholder.name": "Full Name",
            "contact.placeholder.email": "Email",
            "contact.placeholder.message": "Message",
            "contact.send": "Send",
            "contact.status.invalidEmail": "Please enter a valid email address.",
            "contact.status.sending": "Sending message...",
            "contact.status.failed": "Message could not be sent at this time.",
            "contact.status.success": "Success! Status: ",
            "contact.status.sendError": "Failed to send email.",

            "lightbox.close": "Close image viewer",
            "lightbox.prev": "Previous image",
            "lightbox.next": "Next image",

            "contact.prefill.web": "Hello Salih, I would like to get more information about your website development services and discuss my project details.\n\nProject/Need: \nExpected timeline: \nAdditional notes: ",
            "contact.prefill.mobile": "Hello Salih, I would like to get more information about your mobile app development services for iOS and Android.\n\nApp idea/Need: \nTarget platforms (iOS/Android): \nAdditional notes: ",
            "contact.prefill.uiux": "Hello Salih, I would like to get more information about your UI/UX design services.\n\nProject/Product: \nDesign areas needed: \nAdditional notes: ",
            "contact.prefill.custom": "Hello Salih, I would like to get more information about your custom software solutions.\n\nNeed/Problem: \nExpected solution: \nAdditional notes: "
        },
        tr: {
            "nav.home": "Ana Sayfa",
            "nav.projects": "Projeler",
            "nav.contact": "İletişim",
            "nav.menu.open": "Menüyü aç",

            "title.landing": "Portfolyom",
            "title.home": "Kişisel Web Sitem",
            "title.projects": "Projeler | Salih",
            "title.contact": "İletişim | Salih",

            "landing.label": "SİSTEM ARAYÜZÜ",
            "landing.welcome": "HOŞ GELDİNİZ",
            "landing.subtitle": "WEB SİTEME",
            "landing.enter": "Başlatmak için dokunun",
            "landing.status.right1": "PORTFÖY DÜĞÜMÜ",
            "landing.status.right2": "ERİŞİM: HAZIR",
            "landing.status.left1": "SİSTEM: ÇEVRİMİÇİ",

            "home.hi": "Merhaba, ben <span>Salih</span>",
            "home.im": "Ben bir <span></span>",
            "home.description": "Modern, ölçeklenebilir ve kullanıcı odaklı uygulamalar geliştirmeye tutkulu bir yazılım geliştiricisiyim. Ana odağım Flutter ve Dart ile mobil geliştirme olup, backend ve full-stack teknolojilerinde uzmanlığımı genişletiyorum. Gerçek dünya problemlerini pratik yazılım çözümlerine dönüştürmek için yaparak öğrenmeye inanıyorum.",
            "home.download": "CV'mi İndir",
            "home.services.label": "HAKKIMDA",
            "home.services.title": "Birlikte Üretebileceğimiz Çözümler",
            "home.services.description": "Modern, kullanıcı odaklı ve ölçeklenebilir dijital ürünler geliştiriyorum. Aşağıdaki hizmet kartlarından birini seçerek iletişim formuna geçebilir, seçtiğin hizmete özel hazır mesajı düzenleyip bana gönderebilirsin.",
            "home.service.web.tag": "WEB",
            "home.service.web.title": "Web Sitesi Geliştirme",
            "home.service.web.desc": "Kurumsal, portfolyo ve modern web arayüzleri için performanslı ve responsive çözümler.",
            "home.service.mobile.tag": "MOBİL",
            "home.service.mobile.title": "Mobil Uygulama (iOS & Android)",
            "home.service.mobile.desc": "Flutter ile iOS ve Android için kullanıcı odaklı, ölçeklenebilir mobil uygulama geliştirme.",
            "home.service.uiux.tag": "UI / UX",
            "home.service.uiux.title": "Arayüz ve Deneyim Tasarımı",
            "home.service.uiux.desc": "Modern, tutarlı ve etkileyici arayüz tasarımları ile ürün deneyimini güçlendirme.",
            "home.service.custom.tag": "ÖZEL",
            "home.service.custom.title": "Özel Yazılım Çözümleri",
            "home.service.custom.desc": "İhtiyaca özel yazılım, otomasyon ve dijital ürün fikirleri için uçtan uca geliştirme desteği.",
            "home.service.cta": "İletişime Geç",

            "projects.label": "ÇALIŞMALARIM",
            "projects.title": "Projeler",
            "projects.intro": "Modern teknolojiler ve yaratıcı problem çözme yaklaşımıyla geliştirdiğim projelerden bir seçki.",

            "contact.label": "İLETİŞİM KANALI",
            "contact.title": "İletişim",
            "contact.subtitle": "İletişime geçmek için bir mesaj gönderin.",
            "contact.placeholder.name": "Ad Soyad",
            "contact.placeholder.email": "E-posta",
            "contact.placeholder.message": "Mesaj",
            "contact.send": "Gönder",
            "contact.status.invalidEmail": "Lütfen geçerli bir e-posta adresi girin.",
            "contact.status.sending": "Mesaj gönderiliyor...",
            "contact.status.failed": "Mesaj şu anda gönderilemedi.",
            "contact.status.success": "Başarılı! Durum: ",
            "contact.status.sendError": "E-posta gönderimi başarısız oldu.",

            "lightbox.close": "Görsel görüntüleyiciyi kapat",
            "lightbox.prev": "Önceki görsel",
            "lightbox.next": "Sonraki görsel",

            "contact.prefill.web": "Merhaba Salih, web sitesi geliştirme hizmeti hakkında bilgi almak ve proje detaylarını görüşmek istiyorum.\n\nProje/İhtiyaç: \nTahmini teslim süresi beklentim: \nEk notlar: ",
            "contact.prefill.mobile": "Merhaba Salih, iOS ve Android için mobil uygulama geliştirme hizmeti hakkında bilgi almak istiyorum.\n\nUygulama fikri/İhtiyaç: \nHedef platformlar (iOS/Android): \nEk notlar: ",
            "contact.prefill.uiux": "Merhaba Salih, arayüz (UI) ve kullanıcı deneyimi (UX) tasarımı hizmeti hakkında bilgi almak istiyorum.\n\nProje/Ürün: \nİhtiyaç duyduğum tasarım alanları: \nEk notlar: ",
            "contact.prefill.custom": "Merhaba Salih, özel yazılım çözümü geliştirme hizmeti hakkında bilgi almak istiyorum.\n\nİhtiyaç/Problem: \nBeklenen çözüm: \nEk notlar: "
        }
    };

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