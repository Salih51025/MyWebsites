const express = require('express');
const path = require('path');
const app = express();
const port = 8080;

// Statik dosyaları sunmak için `public` dizinini belirtin
app.use(express.static(path.join(__dirname, 'public')));

// Sunucuyu başlatın
app.listen(port, () => {
  console.log(`Sunucu http://localhost:${port} adresinde çalışıyor`);
});
