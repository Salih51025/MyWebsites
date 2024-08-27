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