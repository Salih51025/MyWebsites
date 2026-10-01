function initNavbar() {

const navContainer =
    document.querySelector(".nav-container");

if (!navContainer) {
    console.error("Navbar bulunamadı.");
    return;
}


const menuToggle =
    navContainer.querySelector(".menu-toggle");

const nav =
    navContainer.querySelector("nav");

const navLinks =
    navContainer.querySelectorAll("nav a");


if (!menuToggle || !nav) {
    console.error("Navbar elemanları eksik.");
    return;
}


/* =====================================================
   AKTİF SAYFAYI BUL
   ===================================================== */

const currentPage =
    window.location.pathname
        .split("/")
        .pop()
        .toLowerCase() || "home.html";


navLinks.forEach(link => {

    const page =
        link.dataset.page?.toLowerCase();


    if (page === currentPage) {

        link.classList.add("active");

    } else {

        link.classList.remove("active");

    }

});


/* =====================================================
   HAMBURGER
   ===================================================== */

menuToggle.addEventListener("click", event => {

    event.stopPropagation();

    const isOpen =
        menuToggle.classList.toggle("active");

    nav.classList.toggle(
        "active",
        isOpen
    );

    menuToggle.setAttribute(
        "aria-expanded",
        String(isOpen)
    );

});


/* =====================================================
   NAV LINK
   ===================================================== */

navLinks.forEach(link => {

    link.addEventListener("click", () => {

        /*
            Tıklanan linki görsel olarak
            hemen aktif göster.
        */

        navLinks.forEach(item => {
            item.classList.remove("active");
        });

        link.classList.add("active");


        /*
            Mobil menüyü kapat.
        */

        menuToggle.classList.remove("active");

        nav.classList.remove("active");

        menuToggle.setAttribute(
            "aria-expanded",
            "false"
        );

    });

});


/* =====================================================
   MENÜ DIŞINA TIKLAMA
   ===================================================== */

document.addEventListener("click", event => {

    if (!navContainer.contains(event.target)) {

        menuToggle.classList.remove("active");

        nav.classList.remove("active");

        menuToggle.setAttribute(
            "aria-expanded",
            "false"
        );

    }

});


}
