function initNavbar() {
    const navContainer = document.querySelector(".nav-container");
    if (!navContainer) {
        return;
    }

    const menuToggle = navContainer.querySelector(".menu-toggle");
    const nav = navContainer.querySelector("nav");
    const navLinks = navContainer.querySelectorAll("nav a");

    if (!menuToggle || !nav) {
        return;
    }

    const currentPage =
        window.location.pathname.split("/").pop()?.toLowerCase() || "home.html";

    navLinks.forEach((link) => {
        const page = link.dataset.page?.toLowerCase();
        link.classList.toggle("active", page === currentPage);
    });

    menuToggle.addEventListener("click", (event) => {
        event.stopPropagation();

        const isOpen = menuToggle.classList.toggle("active");
        nav.classList.toggle("active", isOpen);
        menuToggle.setAttribute("aria-expanded", String(isOpen));
    });

    navLinks.forEach((link) => {
        link.addEventListener("click", () => {
            navLinks.forEach((item) => item.classList.remove("active"));
            link.classList.add("active");

            menuToggle.classList.remove("active");
            nav.classList.remove("active");
            menuToggle.setAttribute("aria-expanded", "false");
        });
    });

    document.addEventListener("click", (event) => {
        if (!navContainer.contains(event.target)) {
            menuToggle.classList.remove("active");
            nav.classList.remove("active");
            menuToggle.setAttribute("aria-expanded", "false");
        }
    });
}
