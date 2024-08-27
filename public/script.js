function SendMail() {
    var params = {
        from_name: document.getElementById("fullName").value,
        email_id: document.getElementById("email_id").value,
        message: document.getElementById("message").value
    };
    emailjs.send("service_oajq4ip", "template_2vnw47e", params)
        .then(function (res) {
            alert("Başarılı! Status: " + res.status);
            document.getElementById("contact-form").reset(); // Formu sıfırlar
        })
        .catch(function (error) {
            console.error("Hata: ", error);
            alert("E-posta gönderimi başarısız oldu.");
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



document.querySelector('.hamburger').addEventListener('click', function() {
    document.querySelector('nav').classList.toggle('active');
});



 // Sayfada herhangi bir yere tıklanıldığında, fade-out ve scale-out animasyonu başlatılır
       document.addEventListener("click", function() {
            document.body.classList.add("fade-out");
            setTimeout(function() {
                window.location.href = "screens/home/home.html";
            }, 100); // Animasyonun bitmesini bekleyin
        });