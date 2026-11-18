function SendMail() {
    var params = {
        from_name: document.getElementById("fullName").value,
        email_id: document.getElementById("email_id").value,
        message: document.getElementById("message").value
    };
    var t = function (key, fallback) {
        if (window.siteI18n && typeof window.siteI18n.t === "function") {
            return window.siteI18n.t(key) || fallback;
        }
        return fallback;
    };

    emailjs.send("service_oajq4ip", "template_2vnw47e", params)
        .then(function (res) {
            alert(t("contact.status.success", "Success! Status: ") + res.status);
            document.getElementById("contact-form").reset(); // Formu sıfırlar
            var status = document.getElementById("form-status");
            if (status) {
                status.textContent = "";
                status.className = "form-status";
                status.removeAttribute("data-status-key");
                status.removeAttribute("data-status-type");
            }
        })
        .catch(function (error) {
            console.error("Hata: ", error);
            alert(t("contact.status.sendError", "Failed to send email."));
            var status = document.getElementById("form-status");
            if (status) {
                status.textContent = t("contact.status.failed", "Message could not be sent at this time.");
                status.className = "form-status error";
                status.dataset.statusKey = "contact.status.failed";
                status.dataset.statusType = "error";
            }
        });
}



document.addEventListener('DOMContentLoaded', function() {
    const items = document.querySelectorAll('.navigation li');

    function setActiveClass(event) {
        const target = event.currentTarget;

        // Önce tüm li'lerin aktif sınıfını kaldır
        items.forEach(item => item.classList.remove('active'));

        // Tıklanan li'ye aktif sınıfını ekle
        target.classList.add('active');

        // Navigation menüsüne kaydırma efektini ekle
        document.querySelector('.navigation').classList.add('slide-right');

        // Kaydırma efektinin tamamlandığını belirlemek için bir süre sonra sınıfı kaldır
        setTimeout(() => {
            document.querySelector('.navigation').classList.remove('slide-right');
        }, 1000); // 1 saniye, animasyon süresiyle aynı olmalı
    }

    // Tüm li öğelerine tıklama olay dinleyicisi ekle
    items.forEach(item => item.addEventListener('click', setActiveClass));
});

