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

## Deploy

Uygulama iki modda çalışır:

- **Local/PaaS (fallback):** `DATABASE_URL` ve `BLOB_READ_WRITE_TOKEN` yoksa projeler `data/projects.json` dosyasında, yüklemeler `public/uploads/projects/` altında, session memory store’da tutulur. Bu mod long-running tek instance + persistent disk ister.
- **Vercel/serverless (önerilen Vercel kurulumu):** `DATABASE_URL` varsa projeler Postgres’te ve session `connect-pg-simple` ile Postgres’te tutulur; `BLOB_READ_WRITE_TOKEN` varsa yüklemeler Vercel Blob’a yazılır. Read-only serverless FS’de çalışır.

### Seçenek B — Vercel

1. Projeyi Vercel’e bağlayın (repo import).
2. Vercel Marketplace/Integration ile **Postgres** (Neon/Vercel Postgres) ve **Blob** ekleyin.
3. Environment Variables tanımlayın:

```env
NODE_ENV=production
TRUST_PROXY=1
ADMIN_USER=<guclu-kullanici>
ADMIN_PASSWORD=<guclu-sifre>
SESSION_SECRET=<uzun-rastgele-secret>
COOKIE_SECURE=true
COOKIE_SAMESITE=lax
DATABASE_URL=<postgres-connection-string>
BLOB_READ_WRITE_TOKEN=<vercel-blob-rw-token>
# Optional: SITE_URL=https://your-domain.example
```

4. Deploy edin. `vercel.json` tüm istekleri `server.js` serverless function’a yönlendirir; Express app export edilir.
5. Hostinger’da alınan domaini Vercel projesine ekleyip DNS kayıtlarını Vercel’in verdiği şekilde güncelleyin.

> Not: Vercel modunda `data/projects.json` ve `public/uploads/projects/` kalıcı veri kaynağı değildir; kalıcı kaynaklar Postgres ve Blob’dur.

### Seçenek D1 — Persistent diskli PaaS

- Long-running Node web service (serverless değil), persistent volume/disk, tek instance.
- **Start command:** `npm start`
- **Volume:** `data/projects.json` ve `public/uploads/projects/`
- Gerekli env: `NODE_ENV`, `TRUST_PROXY`, `ADMIN_USER`, `ADMIN_PASSWORD`, `SESSION_SECRET`, `COOKIE_SECURE=true`, `COOKIE_SAMESITE=lax`

## Veri ve Backup

- **Local/PaaS modu:** Projeler `data/projects.json` içinde, yüklemeler `public/uploads/projects/` altında tutulur. Bu yollar kalıcı diskte olmalı; düzenli JSON + uploads backup alınmalı.
- **Vercel modu:** Projeler Postgres’te, yüklemeler Blob’da tutulur. Postgres backup/pitr politikasını ve Blob içeriğini sağlayıcınıza göre yedekleyin.
- Modlar arası geçişte mevcut JSON verisini Postgres’e taşımak için ayrı migration adımı gerekir.

## Güvenlik Notları

- Admin endpoint’leri session + CSRF + rate limit kullanır.
- Varsayılan admin şifresi/secret ile prod çalıştırmayın.
- `.env` dosyasını commit etmeyin.

## Bilinen Mimari Notlar

- **Vercel modu:** Postgres + Vercel Blob + PG session store ile serverless uyumludur. Tek instance kısıtı DB kullanıldığında JSON dosyasına göre daha az kritiktir; yine de admin yazımları düşük hacimlidir.
- **Local/PaaS modu:** JSON dosya tabanlıdır; çoklu instance veya yüksek eşzamanlı yazım için uygun değildir.
- Statik-only deploy (GitHub Pages vb.) admin/API özelliklerini kapsamaz.
