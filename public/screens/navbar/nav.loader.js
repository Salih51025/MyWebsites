function loadNavbar() {
    const placeholder = document.getElementById("nav-placeholder");
    if (!placeholder || placeholder.dataset.loaded === "true") {
        return;
    }

    fetch("../navbar/nav.html")
        .then((response) => {
            if (!response.ok) {
                throw new Error("Navbar yüklenemedi.");
            }
            return response.text();
        })
        .then((html) => {
            placeholder.innerHTML = html;
            placeholder.dataset.loaded = "true";
            initNavbar();
        })
        .catch((error) => {
            console.error("Navbar error:", error);
        });
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", loadNavbar);
} else {
    loadNavbar();
}
