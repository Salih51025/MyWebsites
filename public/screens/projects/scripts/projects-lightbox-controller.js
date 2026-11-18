/* =========================================================
   PROJECT IMAGE LIGHTBOX
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    function () {

        const lightbox =
            document.getElementById(
                "image-lightbox"
            );


        const lightboxImage =
            document.getElementById(
                "lightbox-image"
            );


        const closeButton =
            document.getElementById(
                "lightbox-close"
            );


        const previousButton =
            document.getElementById(
                "lightbox-prev"
            );


        const nextButton =
            document.getElementById(
                "lightbox-next"
            );


        const counter =
            document.getElementById(
                "lightbox-counter"
            );


        /*
            Gerekli HTML elemanları yoksa
            JavaScript'i çalıştırma.
        */

        if (
            !lightbox ||
            !lightboxImage ||
            !closeButton ||
            !previousButton ||
            !nextButton ||
            !counter
        ) {

            return;

        }


        /*
            Şu anda açık olan proje.
        */

        let currentProject = null;


        /*
            Şu anda gösterilen resim.
        */

        let currentIndex = 0;


        /* =====================================================
           PROJECT GALLERY
           ===================================================== */

        function getProjectImages(project) {

            if (!project) {

                return [];

            }


            return Array.from(
                project.querySelectorAll(
                    ".project-gallery .project-image img"
                )
            );

        }


        /* =====================================================
           OPEN LIGHTBOX
           ===================================================== */

        function openLightbox(
            project,
            index
        ) {

            const images =
                getProjectImages(
                    project
                );


            if (!images.length) {

                return;

            }


            currentProject =
                project;


            currentIndex =
                index;


            updateLightbox();


            lightbox.classList.add(
                "active"
            );


            lightbox.setAttribute(
                "aria-hidden",
                "false"
            );


            document.body.style.overflow =
                "hidden";

        }


        /* =====================================================
           UPDATE IMAGE
           ===================================================== */

        function updateLightbox() {

            if (!currentProject) {

                return;

            }


            const images =
                getProjectImages(
                    currentProject
                );


            if (!images.length) {

                return;

            }


            /*
                Index sınırlarını koru.
            */

            if (
                currentIndex < 0
            ) {

                currentIndex =
                    images.length - 1;

            }


            if (
                currentIndex >= images.length
            ) {

                currentIndex = 0;

            }


            const image =
                images[currentIndex];


            /*
                Ana resmi değiştir.
            */

            lightboxImage.src =
                image.src;


            lightboxImage.alt =
                image.alt || "Project image";


            /*
                Counter.
            */

            counter.textContent =
                `${currentIndex + 1} / ${images.length}`;


            /*
                Eğer sadece bir resim varsa
                okları gizle.
            */

            if (
                images.length <= 1
            ) {

                previousButton.style.display =
                    "none";

                nextButton.style.display =
                    "none";

            } else {

                previousButton.style.display =
                    "flex";

                nextButton.style.display =
                    "flex";

            }

        }


        /* =====================================================
           CLOSE LIGHTBOX
           ===================================================== */

        function closeLightbox() {

            lightbox.classList.remove(
                "active"
            );


            lightbox.setAttribute(
                "aria-hidden",
                "true"
            );


            document.body.style.overflow =
                "";


            currentProject =
                null;


            currentIndex =
                0;


            /*
                Eski resmi temizle.
            */

            lightboxImage.src = "";

        }


        /* =====================================================
           NEXT IMAGE
           ===================================================== */

        function showNextImage() {

            if (!currentProject) {

                return;

            }


            const images =
                getProjectImages(
                    currentProject
                );


            if (!images.length) {

                return;

            }


            currentIndex++;

            updateLightbox();

        }


        /* =====================================================
           PREVIOUS IMAGE
           ===================================================== */

        function showPreviousImage() {

            if (!currentProject) {

                return;

            }


            const images =
                getProjectImages(
                    currentProject
                );


            if (!images.length) {

                return;

            }


            currentIndex--;

            updateLightbox();

        }


        /* =====================================================
           PROJECT IMAGE CLICK
           ===================================================== */

        const projectCards =
            document.querySelectorAll(
                ".project-card"
            );


        projectCards.forEach(
            function (project) {

                const images =
                    project.querySelectorAll(
                        ".project-gallery .project-image img"
                    );


                images.forEach(
                    function (image, index) {

                        image.addEventListener(
                            "click",
                            function (event) {

                                event.preventDefault();

                                event.stopPropagation();

                                openLightbox(
                                    project,
                                    index
                                );

                            }
                        );

                    }
                );

            }
        );


        /* =====================================================
           CLOSE BUTTON
           ===================================================== */

        closeButton.addEventListener(
            "click",
            function (event) {

                event.stopPropagation();

                closeLightbox();

            }
        );


        /* =====================================================
           NEXT BUTTON
           ===================================================== */

        nextButton.addEventListener(
            "click",
            function (event) {

                event.stopPropagation();

                showNextImage();

            }
        );


        /* =====================================================
           PREVIOUS BUTTON
           ===================================================== */

        previousButton.addEventListener(
            "click",
            function (event) {

                event.stopPropagation();

                showPreviousImage();

            }
        );


        /* =====================================================
           CLICK OUTSIDE IMAGE
           ===================================================== */

        lightbox.addEventListener(
            "click",
            function (event) {

                if (
                    event.target === lightbox
                ) {

                    closeLightbox();

                }

            }
        );


        /* =====================================================
           KEYBOARD CONTROLS
           ===================================================== */

        document.addEventListener(
            "keydown",
            function (event) {

                /*
                    Lightbox açık değilse
                    hiçbir işlem yapma.
                */

                if (
                    !lightbox.classList.contains(
                        "active"
                    )
                ) {

                    return;

                }


                /*
                    ESC
                */

                if (
                    event.key === "Escape"
                ) {

                    closeLightbox();

                    return;

                }


                /*
                    Sağ ok
                */

                if (
                    event.key === "ArrowRight"
                ) {

                    showNextImage();

                    return;

                }


                /*
                    Sol ok
                */

                if (
                    event.key === "ArrowLeft"
                ) {

                    showPreviousImage();

                    return;

                }

            }
        );


    }
);
