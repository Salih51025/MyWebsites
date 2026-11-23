# MyWebsites

Salih Aydın kişisel portföy sitesi. Statik frontend (`public/`) ve Express tabanlı admin/API katmanından oluşur.

## Özellikler

- EN/TR dil desteği
- Dinamik proje listesi (`/api/projects`)
- Admin paneli ile proje CRUD, sıralama, görsel yükleme/temizlik
- İletişim formu (EmailJS)
- JSON tabanlı veri saklama (`data/projects.json`)

## Teknoloji

- Node.js + Express
- Vanilla HTML/CSS/JS
- `express-session`, `multer`, `express-rate-limit`, `dotenv`

## Yerel Geliştirme

### Gereksinimler

- Node.js 24.x (bkz. `package.json` engines)
- npm

### Kurulum

```bash
npm install
cp .env.example .env
```

Windows PowerShell için:

```powershell
npm install
Copy-Item .env.example .env
```

`.env` içindeki en az şu değerleri güncelle:

- `ADMIN_USER`
- `ADMIN_PASSWORD`
- `SESSION_SECRET`

### Çalıştırma

```bash
npm start
```

Varsayılan adres: `http://localhost:8080`

## Önemli Dizinler

```text
server.js                 # Express server + API + admin + static serving
data/projects.json        # Proje verisi
public/                   # Frontend statik dosyalar
public/uploads/projects/  # Admin ile yüklenen görseller (runtime)
public/screens/admin/     # Admin login/proje yönetimi
```

## Deploy (D1 + PaaS)

Seçilen model: **D1 - tek Node/Express servisi, PaaS üzerinde**.

### PaaS Gereksinimleri

- Long-running Node web service (serverless değil)
- Persistent volume/disk
- Tek instance (JSON dosyasına eşzamanlı yazımı önlemek için)
- HTTPS + ortam değişkenleri/secrets desteği

### PaaS Ayarları

- **Start command:** `npm start`
- **Port:** Platform `PORT` env verir; uygulama bunu kullanır.
- **Volume:**  
  - `data/projects.json`  
  - `public/uploads/projects/`

### Prod Ortam Değişkenleri

```env
NODE_ENV=production
TRUST_PROXY=1
ADMIN_USER=<guclu-kullanici>
ADMIN_PASSWORD=<guclu-sifre>
SESSION_SECRET=<uzun-rastgele-secret>
COOKIE_SECURE=true
COOKIE_SAMESITE=lax
```

> `COOKIE_SECURE=true` için HTTPS gereklidir. `TRUST_PROXY` değerini PaaS proxy yapısına göre doğrulayın.

## Veri ve Backup

- Projeler `data/projects.json` içinde tutulur.
- Yüklenen görseller `public/uploads/projects/` altına yazılır.
- PaaS üzerinde bu iki yol kalıcı diskte olmalıdır.
- Düzenli backup alın: JSON + uploads.
- Backup geri yükleme testi yapılmalıdır.

## Güvenlik Notları

- Admin endpoint’leri session + CSRF + rate limit kullanır.
- Varsayılan admin şifresi/secret ile prod çalıştırmayın.
- `.env` dosyasını commit etmeyin.

## Bilinen Mimari Notlar

- Proje verisi dosya tabanlıdır; çoklu instance veya yüksek eşzamanlı yazım için SQLite/Postgres değerlendirilebilir.
- Bu repo D1 dinamik deploy için uygundur; statik-only deploy (GitHub Pages vb.) admin/API özelliklerini kapsamaz.
