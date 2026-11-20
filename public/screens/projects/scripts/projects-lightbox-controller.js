/* =========================================================
   PROJECT IMAGE LIGHTBOX (dynamic-content compatible)
   ========================================================= */

document.addEventListener("DOMContentLoaded", function () {
    const lightbox = document.getElementById("image-lightbox");
    const lightboxImage = document.getElementById("lightbox-image");
    const closeButton = document.getElementById("lightbox-close");
    const previousButton = document.getElementById("lightbox-prev");
    const nextButton = document.getElementById("lightbox-next");
    const counter = document.getElementById("lightbox-counter");

    if (!lightbox || !lightboxImage || !closeButton || !previousButton || !nextButton || !counter) {
        return;
    }

    let currentProject = null;
    let currentIndex = 0;

    function getProjectImages(project) {
        if (!project) return [];
        return Array.from(project.querySelectorAll(".project-gallery .project-image img"));
    }

    function openLightbox(project, index) {
        const images = getProjectImages(project);
        if (!images.length) return;

        currentProject = project;
        currentIndex = index;
        updateLightbox();

        lightbox.classList.add("active");
        lightbox.setAttribute("aria-hidden", "false");
        document.body.style.overflow = "hidden";
    }

    function updateLightbox() {
        if (!currentProject) return;
        const images = getProjectImages(currentProject);
        if (!images.length) return;

        if (currentIndex < 0) currentIndex = images.length - 1;
        if (currentIndex >= images.length) currentIndex = 0;

        const image = images[currentIndex];
        lightboxImage.src = image.currentSrc || image.src;
        lightboxImage.alt = image.alt || "Project image";
        counter.textContent = `${currentIndex + 1} / ${images.length}`;

        const showArrows = images.length > 1;
        previousButton.style.display = showArrows ? "flex" : "none";
        nextButton.style.display = showArrows ? "flex" : "none";
    }

    function closeLightbox() {
        lightbox.classList.remove("active");
        lightbox.setAttribute("aria-hidden", "true");
        document.body.style.overflow = "";
        currentProject = null;
        currentIndex = 0;
        lightboxImage.src = "";
    }

    function showNextImage() {
        if (!currentProject) return;
        const images = getProjectImages(currentProject);
        if (!images.length) return;
        currentIndex++;
        updateLightbox();
    }

    function showPreviousImage() {
        if (!currentProject) return;
        const images = getProjectImages(currentProject);
        if (!images.length) return;
        currentIndex--;
        updateLightbox();
    }

    // Event delegation for statically and dynamically rendered project cards
    document.addEventListener("click", function (event) {
        const image = event.target.closest(".project-gallery .project-image img");
        if (!image) return;

        const project = image.closest(".project-card");
        if (!project) return;

        event.preventDefault();
        event.stopPropagation();

        const images = getProjectImages(project);
        const index = images.indexOf(image);
        openLightbox(project, index >= 0 ? index : 0);
    });

    closeButton.addEventListener("click", function (event) {
        event.stopPropagation();
        closeLightbox();
    });

    nextButton.addEventListener("click", function (event) {
        event.stopPropagation();
        showNextImage();
    });

    previousButton.addEventListener("click", function (event) {
        event.stopPropagation();
        showPreviousImage();
    });

    lightbox.addEventListener("click", function (event) {
        if (event.target === lightbox) {
            closeLightbox();
        }
    });

    document.addEventListener("keydown", function (event) {
        if (!lightbox.classList.contains("active")) return;

        if (event.key === "Escape") {
            closeLightbox();
            return;
        }
        if (event.key === "ArrowRight") {
            showNextImage();
            return;
        }
        if (event.key === "ArrowLeft") {
            showPreviousImage();
        }
    });
});
