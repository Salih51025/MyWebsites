require("dotenv").config();

const express = require("express");
const path = require("path");
const session = require("express-session");

const {
  COOKIE_SAMESITE,
  COOKIE_SECURE,
  NODE_ENV,
  PORT,
  PUBLIC_DIR,
  SESSION_SECRET,
  TRUST_PROXY,
} = require("./lib/config");
const { ensureStorage } = require("./lib/project-store");
const { adminApiLimiter } = require("./lib/security");
const { registerRoutes } = require("./lib/register-routes");

const app = express();

ensureStorage();

if (TRUST_PROXY != null && TRUST_PROXY !== "") {
  const tpNum = Number(TRUST_PROXY);
  app.set("trust proxy", Number.isFinite(tpNum) ? tpNum : TRUST_PROXY);
} else {
  app.set("trust proxy", 1);
}

app.use(
  session({
    name: "admin.sid",
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: ["lax", "strict", "none"].includes(COOKIE_SAMESITE) ? COOKIE_SAMESITE : "lax",
      secure: COOKIE_SAMESITE === "none" ? true : COOKIE_SECURE,
      maxAge: 1000 * 60 * 60 * 8,
    },
  })
);

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.use("/api/admin", adminApiLimiter);

registerRoutes(app);

app.use(express.static(PUBLIC_DIR));

app.get("/", (_req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Sunucu hatası." });
});

app.listen(PORT, () => {
  console.log(`Sunucu http://localhost:${PORT} adresinde çalışıyor`);
  if (!process.env.ADMIN_PASSWORD || !process.env.SESSION_SECRET) {
    console.log("Uyarı: ADMIN_PASSWORD ve/veya SESSION_SECRET tanımlı değil. Geliştirme varsayılanları kullanılıyor.");
  }
  if (NODE_ENV === "production" && !COOKIE_SECURE && COOKIE_SAMESITE !== "none") {
    console.log("Uyarı: Production ortamında COOKIE_SECURE=true önerilir.");
  }
});
