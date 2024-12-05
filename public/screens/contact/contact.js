// EmailJS servisinin yüklenmesini bekliyoruz
(function () {
    emailjs.init("d_DwnmGk57jH8CiAl"); // Buraya EmailJS kullanıcı ID'nizi eklemelisiniz
  })();
  
  // E-posta gönderme fonksiyonu
  function SendMail() {
    // Kullanıcı verilerini al
    var fullName = document.getElementById('from_name').value;
    var email = document.getElementById('email_id').value;
    var message = document.getElementById('message').value;
  
    // Gerekli alanların boş olup olmadığını kontrol et
    if (!fullName || !email || !message) {
      alert("Please fill all fields before sending the message.");
      return;
    }
  
    // Geçerli bir e-posta adresi olup olmadığını kontrol et
    var emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailPattern.test(email)) {
      alert("Please enter a valid email address.");
      return;
    }
  
    // E-posta gönderme parametreleri
    var templateParams = {
      from_name: fullName,
      from_email: email,
      message: message
    };
  
    // E-posta gönderme işlemi
    emailjs.send('d_DwnmGk57jH8CiAl', 'template_2vnw47e', templateParams)
      .then(function(response) {
        console.log('SUCCESS!', response);
        alert("Your message has been sent successfully!");  
      }, function(error) {
        console.log('FAILED...', error);
        alert("There was an error sending your message. Please try again later.");
      });
  }
  