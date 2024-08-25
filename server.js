const express = require('express');
const path = require('path');
const app = express();
const port = 8080;

// Public klasöründeki dosyaları sunmak için middleware kullanıyoruz
app.use(express.static(path.join(__dirname, 'public')));

// Varsayılan rota: index.html dosyasını sunar
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Diğer tüm istekler için home.html dosyasını sunuyoruz
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'screens', 'home', 'home.html'));
});

app.listen(port, () => {
  console.log(`Sunucu http://localhost:${port} adresinde çalışıyor`);
});
