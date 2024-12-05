    fetch('../navbar/nav.html')
                .then(response => response.text())
                .then(data => {
                    document.getElementById('nav-placeholder').innerHTML = data;
                });

            const imgContainer = document.querySelector('.img-container');

            imgContainer.addEventListener('wheel', (e) => {
                e.preventDefault();
                imgContainer.scrollLeft += e.deltaY; // Scroll kaydırma
            });

            // Resmi ve ek içeriği toggle yapan fonksiyon
            function toggleProject(container) {
                const img = container.querySelector('.project-image');
                const additionalContent = document.getElementById('additional-content' + container.id.replace('project', ''));

                if (img.style.display !== 'none') {
                    img.style.display = 'none'; // Resmi gizle
                    additionalContent.classList.remove('hidden'); // Ek içeriği göster
                } else {
                    img.style.display = 'block'; // Resmi geri getir
                    additionalContent.classList.add('hidden'); // Ek içeriği gizle
                }
            }

            // "Back" butonuna tıklayınca resmi geri getiren fonksiyon
            function toggleProjectback(projectId) {
                const img = document.querySelector('#' + projectId + ' .project-image'); // İlgili projenin resmini seç
                const additionalContent = document.getElementById('additional-content' + projectId.replace('project', '')); // İlgili projenin ek içeriğini seç

                img.style.display = 'block'; // Resmi göster
                additionalContent.classList.add('hidden'); // Ek içeriği gizle
            }
