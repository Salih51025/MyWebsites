require("dotenv").config();

const crypto = require("crypto");
const express = require("express");
const fs = require("fs");
const fsp = require("fs/promises");
const multer = require("multer");
const path = require("path");
const session = require("express-session");
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");
const compression = require("compression");
const connectPgSimple = require("connect-pg-simple");
const { Pool } = require("pg");
const { createDataStore } = require("./lib/data-store");
const { createUploadStore } = require("./lib/upload-store");

const app = express();
const port = process.env.PORT || 8080;

app.disable("x-powered-by");
app.use(helmet({
  contentSecurityPolicy: false, // Site uses inline scripts/styles and external CDNs; CSP can be tightened later with a full allowlist.
  crossOriginEmbedderPolicy: false,
}));
app.use(compression());

const ROOT_DIR = __dirname;
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT_DIR, "data");
const DATA_FILE = process.env.DATA_FILE || path.join(DATA_DIR, "projects.json");
const PUBLIC_DIR = process.env.PUBLIC_DIR || path.join(ROOT_DIR, "public");
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(PUBLIC_DIR, "uploads", "projects");
const DATABASE_URL = (process.env.DATABASE_URL || process.env.POSTGRES_URL || "").trim();
const BLOB_READ_WRITE_TOKEN = (process.env.BLOB_READ_WRITE_TOKEN || "").trim();

const ADMIN_USER = process.env.ADMIN_USER || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";
const SESSION_SECRET = process.env.SESSION_SECRET || "change-this-session-secret";
const NODE_ENV = process.env.NODE_ENV || "development";
const TRUST_PROXY = process.env.TRUST_PROXY;

if (NODE_ENV === "production") {
  const missing = [];
  if (!process.env.ADMIN_PASSWORD) missing.push("ADMIN_PASSWORD");
  if (!process.env.SESSION_SECRET) missing.push("SESSION_SECRET");
  if (missing.length) {
    console.error(`Missing required environment variables for production: ${missing.join(", ")}`);
    process.exit(1);
  }
}

function parseBool(value, fallback = false) {
  if (value == null || value === "") return fallback;
  const v = String(value).toLowerCase();
  if (["1", "true", "yes", "on"].includes(v)) return true;
  if (["0", "false", "no", "off"].includes(v)) return false;
  return fallback;
}

const COOKIE_SECURE = (() => {
  if (process.env.COOKIE_SECURE != null && process.env.COOKIE_SECURE !== "") {
    return parseBool(process.env.COOKIE_SECURE, false);
  }
  return NODE_ENV === "production";
})();

const COOKIE_SAMESITE = (process.env.COOKIE_SAMESITE || "lax").toLowerCase();

function toInt(value, fallback) {
  const n = parseInt(value, 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

const LOGIN_RATE_LIMIT_WINDOW_MS = toInt(process.env.LOGIN_RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000);
const LOGIN_RATE_LIMIT_MAX = toInt(process.env.LOGIN_RATE_LIMIT_MAX, 10);
const ADMIN_RATE_LIMIT_WINDOW_MS = toInt(process.env.ADMIN_RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000);
const ADMIN_RATE_LIMIT_MAX = toInt(process.env.ADMIN_RATE_LIMIT_MAX, 300);

const dataStore = createDataStore({ databaseUrl: DATABASE_URL, dataDir: DATA_DIR, dataFile: DATA_FILE });
const uploadStore = createUploadStore({ blobToken: BLOB_READ_WRITE_TOKEN, uploadDir: UPLOAD_DIR });

let sessionPool = null;
function getSessionPool() {
  if (!DATABASE_URL) return null;
  if (!sessionPool) {
    sessionPool = new Pool({
      connectionString: DATABASE_URL,
      max: Number(process.env.SESSION_PG_POOL_MAX || 2),
      ssl: process.env.PG_SSL === "false" ? false : { rejectUnauthorized: false },
    });
  }
  return sessionPool;
}

async function readProjects() {
  return dataStore.readProjects();
}

async function writeProjects(projects) {
  return dataStore.writeProjects(projects);
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeParagraphs(value) {
  if (Array.isArray(value)) {
    return value.map((v) => normalizeText(v)).filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(/\r?\n+/)
      .map((v) => v.trim())
      .filter(Boolean);
  }
  return [];
}

function normalizeImages(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((img) => {
      if (!img) return null;
      if (typeof img === "string") {
        const src = normalizeText(img);
        return src ? { src, alt: { en: "", tr: "" } } : null;
      }
      const src = normalizeText(img.src || img.url || img.path);
      if (!src) return null;
      const alt = img.alt && typeof img.alt === "object" ? img.alt : {};
      return {
        src,
        alt: {
          en: normalizeText(alt.en),
          tr: normalizeText(alt.tr),
        },
      };
    })
    .filter(Boolean);
}

function normalizeProjectInput(body, existing) {
  const existingProject = existing || {};
  const now = new Date().toISOString();
  const id = normalizeText(body.id) || existingProject.id || crypto.randomUUID();
  const orderNum = Number(body.order);
  const order = Number.isFinite(orderNum) && orderNum > 0 ? Math.floor(orderNum) : (existingProject.order || 0);
  const numberLabel = normalizeText(body.numberLabel) || existingProject.numberLabel || String(order || 0).padStart(2, "0");
  const status = body.status === "draft" ? "draft" : "published";

  const category = body.category && typeof body.category === "object" ? body.category : {};
  const title = body.title && typeof body.title === "object" ? body.title : {};
  const description = body.description && typeof body.description === "object" ? body.description : {};

  return {
    id,
    order,
    numberLabel,
    status,
    category: {
      en: normalizeText(category.en),
      tr: normalizeText(category.tr),
    },
    title: {
      en: normalizeText(title.en),
      tr: normalizeText(title.tr),
    },
    description: {
      en: normalizeParagraphs(description.en),
      tr: normalizeParagraphs(description.tr),
    },
    images: normalizeImages(body.images),
    createdAt: existingProject.createdAt || now,
    updatedAt: now,
  };
}

function validateProject(project) {
  const errors = [];
  if (!project.title.en || !project.title.tr) errors.push("Proje başlığı (EN/TR) zorunludur.");
  if (!project.category.en || !project.category.tr) errors.push("Kategori (EN/TR) zorunludur.");
  if (!project.description.en.length || !project.description.tr.length) {
    errors.push("Açıklama (EN/TR) için en az bir paragraf gereklidir.");
  }
  if (!project.images.length) errors.push("En az bir görsel eklenmelidir.");
  if (!project.order || project.order < 1) errors.push("Geçerli bir sıra (order) değeri gereklidir.");
  return errors;
}

function sortProjects(projects) {
  return [...projects].sort((a, b) => {
    const ao = Number(a.order) || 0;
    const bo = Number(b.order) || 0;
    if (ao !== bo) return ao - bo;
    return String(a.createdAt || "").localeCompare(String(b.createdAt || ""));
  });
}

function getOrCreateCsrfToken(req) {
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString("hex");
  }
  return req.session.csrfToken;
}

function requireAdmin(req, res, next) {
  if (req.session && req.session.isAdmin) return next();
  return res.status(401).json({ error: "Yetkisiz erişim. Lütfen giriş yapın." });
}

function requireCsrf(req, res, next) {
  const method = (req.method || "GET").toUpperCase();
  if (["GET", "HEAD", "OPTIONS"].includes(method)) return next();
  const sessionToken = req.session && req.session.csrfToken;
  const headerToken = req.get("x-csrf-token");
  const bodyToken = req.body && typeof req.body === "object" ? req.body._csrf : null;
  const token = headerToken || bodyToken;
  if (!sessionToken || !token || token !== sessionToken) {
    return res.status(403).json({ error: "Geçersiz veya eksik CSRF token." });
  }
  return next();
}

function safeUnlink(filePath) {
  return fsp.unlink(filePath).catch((err) => {
    if (err && err.code === "ENOENT") return;
    console.warn("Dosya silinemedi:", filePath, err.message);
  });
}

function isValidImageSignatureBuffer(buf) {
  if (!buf || buf.length < 3) return false;
  // JPEG
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return true;
  // PNG
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 && buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a) return true;
  // GIF87a/GIF89a
  if (buf.length >= 6 && buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38 && (buf[4] === 0x37 || buf[4] === 0x39) && buf[5] === 0x61) return true;
  // WEBP: RIFF....WEBP
  if (buf.length >= 12 && buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 && buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) return true;
  return false;
}

async function isValidImageSignature(file) {
  try {
    if (file && file.buffer) return isValidImageSignatureBuffer(file.buffer);
    if (Buffer.isBuffer(file)) return isValidImageSignatureBuffer(file);
    const filePath = typeof file === "string" ? file : (file && file.path);
    if (!filePath) return false;
    const fh = await fsp.open(filePath, "r");
    try {
      const buf = Buffer.alloc(12);
      const { bytesRead } = await fh.read(buf, 0, 12, 0);
      return isValidImageSignatureBuffer(buf.subarray(0, bytesRead));
    } finally {
      await fh.close();
    }
  } catch (_e) {
    return false;
  }
}

function getUploadUsageMap(projects) {
  const usage = new Map();
  (projects || []).forEach((p) => {
    (p.images || []).forEach((img) => {
      const src = normalizeText(img && img.src);
      if (!uploadStore.isManagedSrc(src)) return;
      const key = uploadStore.srcToKey(src);
      if (!key) return;
      if (!usage.has(key)) usage.set(key, []);
      usage.get(key).push({ projectId: p.id, projectTitle: p.title && (p.title.tr || p.title.en) || "" });
    });
  });
  return usage;
}

async function listUploadFiles(projects) {
  const usage = getUploadUsageMap(projects);
  let files = [];
  try {
    files = await uploadStore.listFiles();
  } catch (_e) {
    files = [];
  }
  const items = files.map((file) => {
    const key = file.filename || uploadStore.srcToKey(file.src) || file.pathname || file.src;
    const refs = usage.get(key) || usage.get(file.filename) || [];
    return {
      filename: file.filename || key,
      pathname: file.pathname,
      src: file.src,
      size: file.size ?? null,
      mtime: file.mtime || null,
      referencedCount: refs.length,
      referencedBy: refs.slice(0, 5),
      isReferenced: refs.length > 0,
    };
  });
  items.sort((a, b) => String(b.mtime || "").localeCompare(String(a.mtime || "")));
  return items;
}

async function cleanupOrphanUploads(projects) {
  const used = new Set();
  (projects || []).forEach((p) => {
    (p.images || []).forEach((img) => {
      const src = normalizeText(img && img.src);
      if (!uploadStore.isManagedSrc(src)) return;
      const key = uploadStore.srcToKey(src);
      if (key) used.add(key);
    });
  });

  let files = [];
  try { files = await uploadStore.listFiles(); } catch (_e) { return { removed: 0, scanned: 0 }; }

  let removed = 0;
  for (const file of files) {
    const key = file.filename || uploadStore.srcToKey(file.src);
    if (!key || used.has(key)) continue;
    try {
      await uploadStore.removeBySrc(file.src);
      removed += 1;
    } catch (_e) {}
  }
  return { removed, scanned: files.length };
}

async function cleanupMissingUploadReferences(projects) {
  let files = [];
  try { files = await uploadStore.listFiles(); } catch (_e) { files = []; }
  const existing = new Set();
  files.forEach((f) => {
    if (f.filename) existing.add(f.filename);
    const key = uploadStore.srcToKey(f.src);
    if (key) existing.add(key);
  });

  let removedReferences = 0;
  let affectedProjects = 0;

  (projects || []).forEach((project) => {
    const before = Array.isArray(project.images) ? project.images.length : 0;
    const filtered = (project.images || []).filter((img) => {
      const src = normalizeText(img && img.src);
      if (!uploadStore.isManagedSrc(src)) return true;
      const key = uploadStore.srcToKey(src);
      const keep = !!(key && existing.has(key));
      if (!keep) removedReferences += 1;
      return keep;
    });
    if (filtered.length !== before) {
      project.images = filtered;
      project.updatedAt = new Date().toISOString();
      affectedProjects += 1;
    }
  });

  return { removedReferences, affectedProjects };
}

let readyPromise = null;
function ensureReady() {
  if (!readyPromise) {
    readyPromise = Promise.all([dataStore.init(), uploadStore.init()]).catch((err) => {
      readyPromise = null;
      throw err;
    });
  }
  return readyPromise;
}

app.use((req, res, next) => {
  ensureReady().then(() => next()).catch(next);
});

if (TRUST_PROXY != null && TRUST_PROXY !== "") {
  const tpNum = Number(TRUST_PROXY);
  app.set("trust proxy", Number.isFinite(tpNum) ? tpNum : TRUST_PROXY);
} else {
  app.set("trust proxy", 1);
}

const sessionOptions = {
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
};

if (DATABASE_URL) {
  const PgSession = connectPgSimple(session);
  sessionOptions.store = new PgSession({
    pool: getSessionPool(),
    createTableIfMissing: true,
  });
}

app.use(session(sessionOptions));

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

const loginLimiter = rateLimit({
  windowMs: LOGIN_RATE_LIMIT_WINDOW_MS,
  max: LOGIN_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Çok fazla giriş denemesi. Lütfen daha sonra tekrar deneyin." },
});

const adminApiLimiter = rateLimit({
  windowMs: ADMIN_RATE_LIMIT_WINDOW_MS,
  max: ADMIN_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Çok fazla istek. Lütfen daha sonra tekrar deneyin." },
});

app.use("/api/admin", adminApiLimiter);

let _upload = null;
function getUpload() {
  if (!_upload) {
    _upload = multer({
      storage: uploadStore.multerStorage(),
      limits: { fileSize: 8 * 1024 * 1024, files: 20 },
      fileFilter: (_req, file, cb) => {
        if ((file.mimetype || "").startsWith("image/")) return cb(null, true);
        cb(new Error("Sadece görsel dosyaları yüklenebilir."));
      },
    });
  }
  return _upload;
}

app.get("/api/projects", async (_req, res) => {
  try {
    const projects = sortProjects(await readProjects()).filter((p) => p.status !== "draft");
    res.json({ projects });
  } catch (error) {
    res.status(500).json({ error: "Projeler okunamadı." });
  }
});

app.get("/api/admin/csrf", (req, res) => {
  const csrfToken = getOrCreateCsrfToken(req);
  res.json({ csrfToken });
});

app.post("/api/admin/login", loginLimiter, requireCsrf, (req, res) => {
  const username = normalizeText(req.body.username);
  const password = typeof req.body.password === "string" ? req.body.password : "";
  if (username === ADMIN_USER && password === ADMIN_PASSWORD) {
    req.session.isAdmin = true;
    req.session.adminUser = username;
    const csrfToken = getOrCreateCsrfToken(req);
    return res.json({ ok: true, user: { username }, csrfToken });
  }
  return res.status(401).json({ error: "Kullanıcı adı veya şifre hatalı." });
});

app.post("/api/admin/logout", requireCsrf, (req, res) => {
  if (!req.session) return res.json({ ok: true });
  req.session.destroy(() => {
    res.clearCookie("admin.sid");
    res.json({ ok: true });
  });
});

app.get("/api/admin/me", (req, res) => {
  if (req.session && req.session.isAdmin) {
    return res.json({
      authenticated: true,
      user: { username: req.session.adminUser || ADMIN_USER },
      csrfToken: getOrCreateCsrfToken(req),
    });
  }
  return res.status(401).json({ authenticated: false });
});

app.get("/api/admin/projects", requireAdmin, async (_req, res) => {
  try {
    const projects = sortProjects(await readProjects());
    res.json({ projects });
  } catch (error) {
    res.status(500).json({ error: "Projeler okunamadı." });
  }
});

app.get("/api/admin/projects/:id", requireAdmin, async (req, res) => {
  try {
    const projects = await readProjects();
    const project = projects.find((p) => p.id === req.params.id);
    if (!project) return res.status(404).json({ error: "Proje bulunamadı." });
    res.json({ project });
  } catch (error) {
    res.status(500).json({ error: "Proje okunamadı." });
  }
});

app.post("/api/admin/projects", requireAdmin, requireCsrf, async (req, res) => {
  try {
    const projects = await readProjects();
    const project = normalizeProjectInput(req.body || {}, null);
    if (!project.order) project.order = (projects.reduce((max, p) => Math.max(max, Number(p.order) || 0), 0) || 0) + 1;
    if (!normalizeText(req.body.numberLabel)) project.numberLabel = String(project.order).padStart(2, "0");
    const errors = validateProject(project);
    if (errors.length) return res.status(400).json({ error: errors.join(" ") });
    projects.push(project);
    await writeProjects(projects);
    res.status(201).json({ project });
  } catch (error) {
    res.status(500).json({ error: "Proje oluşturulamadı." });
  }
});

app.put("/api/admin/projects/:id", requireAdmin, requireCsrf, async (req, res) => {
  try {
    const projects = await readProjects();
    const index = projects.findIndex((p) => p.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: "Proje bulunamadı." });
    const updated = normalizeProjectInput({ ...req.body, id: req.params.id }, projects[index]);
    const errors = validateProject(updated);
    if (errors.length) return res.status(400).json({ error: errors.join(" ") });
    projects[index] = updated;
    await writeProjects(projects);
    res.json({ project: updated });
  } catch (error) {
    res.status(500).json({ error: "Proje güncellenemedi." });
  }
});

app.delete("/api/admin/projects/:id", requireAdmin, requireCsrf, async (req, res) => {
  try {
    const projects = await readProjects();
    const index = projects.findIndex((p) => p.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: "Proje bulunamadı." });
    const [removed] = projects.splice(index, 1);
    await writeProjects(projects);
    res.json({ ok: true, project: removed });
  } catch (error) {
    res.status(500).json({ error: "Proje silinemedi." });
  }
});

app.post("/api/admin/uploads", requireAdmin, requireCsrf, (req, res) => {
  getUpload().array("images", 20)(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ error: err.message || "Yükleme başarısız." });
    }
    const uploaded = Array.isArray(req.files) ? req.files : [];
    for (const file of uploaded) {
      const ok = await isValidImageSignature(file);
      if (!ok) {
        await Promise.all(uploaded.map((f) => (f.path ? safeUnlink(f.path) : Promise.resolve())));
        return res.status(400).json({ error: "Geçersiz görsel dosyası. Sadece gerçek PNG/JPEG/GIF/WEBP dosyaları yüklenebilir." });
      }
    }
    try {
      const files = [];
      for (const file of uploaded) {
        const stored = await uploadStore.finalizeUpload(file);
        files.push({
          src: stored.src,
          filename: stored.filename,
          pathname: stored.pathname,
          originalName: file.originalname,
          size: file.size,
          mimetype: file.mimetype,
        });
      }
      return res.status(201).json({ files });
    } catch (e) {
      return res.status(500).json({ error: "Yükleme kaydedilemedi." });
    }
  });
});

app.get("/api/admin/uploads", requireAdmin, async (_req, res) => {
  try {
    const projects = await readProjects();
    const files = await listUploadFiles(projects);
    res.json({ files });
  } catch (error) {
    res.status(500).json({ error: "Yüklemeler listelenemedi." });
  }
});

app.delete("/api/admin/uploads/:filename", requireAdmin, requireCsrf, async (req, res) => {
  try {
    const rawName = String(req.params.filename || "");
    const filename = path.basename(rawName);
    if (!filename || filename !== rawName) {
      return res.status(400).json({ error: "Geçersiz dosya adı." });
    }
    const projects = await readProjects();
    const usage = getUploadUsageMap(projects);
    const refs = usage.get(filename) || [];
    if (refs.length > 0) {
      return res.status(409).json({ error: "Bu görsel projelerde kullanılıyor. Önce projelerden kaldırın.", referencedBy: refs.slice(0, 10), referencedCount: refs.length });
    }
    // Find the actual src from upload store listing
    const files = await uploadStore.listFiles();
    const match = files.find((f) => f.filename === filename || uploadStore.srcToKey(f.src) === filename);
    if (match) {
      await uploadStore.removeBySrc(match.src);
    } else {
      await uploadStore.removeBySrc(`/uploads/projects/${filename}`);
    }
    res.json({ ok: true, filename });
  } catch (error) {
    res.status(500).json({ error: "Yükleme silinemedi." });
  }
});

app.post("/api/admin/uploads/cleanup", requireAdmin, requireCsrf, async (_req, res) => {
  try {
    const projects = await readProjects();
    const result = await cleanupOrphanUploads(projects);
    res.json({ ok: true, ...result });
  } catch (error) {
    res.status(500).json({ error: "Orphan upload temizliği başarısız." });
  }
});

app.post("/api/admin/projects/cleanup-image-references", requireAdmin, requireCsrf, async (_req, res) => {
  try {
    const projects = await readProjects();
    const result = await cleanupMissingUploadReferences(projects);
    if (result.affectedProjects > 0 || result.removedReferences > 0) {
      await writeProjects(projects);
    }
    res.json({ ok: true, ...result });
  } catch (error) {
    res.status(500).json({ error: "Kırık görsel referansları temizlenemedi." });
  }
});

app.post("/api/admin/projects/reorder", requireAdmin, requireCsrf, async (req, res) => {
  try {
    const items = Array.isArray(req.body.items) ? req.body.items : null;
    if (!items || !items.length) {
      return res.status(400).json({ error: "Geçerli bir sıralama listesi gönderilmelidir." });
    }
    const projects = await readProjects();
    const byId = new Map(projects.map((p) => [p.id, p]));
    const seen = new Set();
    let changed = 0;

    // Apply explicit order for provided items in given sequence
    items.forEach((item, index) => {
      const id = normalizeText(item && item.id);
      if (!id || seen.has(id)) return;
      const project = byId.get(id);
      if (!project) return;
      seen.add(id);
      const nextOrder = index + 1;
      const nextNumber = String(nextOrder).padStart(2, "0");
      if (project.order !== nextOrder || project.numberLabel !== nextNumber) {
        project.order = nextOrder;
        project.numberLabel = nextNumber;
        project.updatedAt = new Date().toISOString();
        changed += 1;
      }
    });

    // Append any projects not included in payload, keeping relative order
    const remaining = sortProjects(projects.filter((p) => !seen.has(p.id)));
    let nextOrder = items.length + 1;
    remaining.forEach((project) => {
      const nextNumber = String(nextOrder).padStart(2, "0");
      if (project.order !== nextOrder || project.numberLabel !== nextNumber) {
        project.order = nextOrder;
        project.numberLabel = nextNumber;
        project.updatedAt = new Date().toISOString();
        changed += 1;
      }
      nextOrder += 1;
    });

    await writeProjects(projects);
    res.json({ ok: true, changed, projects: sortProjects(projects) });
  } catch (error) {
    res.status(500).json({ error: "Sıralama güncellenemedi." });
  }
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, status: "healthy", env: NODE_ENV, timestamp: new Date().toISOString() });
});

function getSiteBaseUrl(req) {
  const configured = normalizeText(process.env.SITE_URL).replace(/\/+$/, "");
  if (configured) return configured;
  const proto = req.protocol || "http";
  const host = req.get("host");
  return host ? `${proto}://${host}` : "";
}

app.get("/robots.txt", (req, res) => {
  const base = getSiteBaseUrl(req);
  const lines = ["User-agent: *", "Allow: /"];
  if (base) lines.push(`Sitemap: ${base}/sitemap.xml`);
  res.type("text/plain").send(lines.join("\n") + "\n");
});

app.get("/sitemap.xml", (req, res) => {
  const base = getSiteBaseUrl(req);
  const urls = ["/", "/screens/home/home.html", "/screens/projects/projects.html", "/screens/contact/contact.html"];
  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls.map((u) => `  <url><loc>${base}${u}</loc></url>`),
    "</urlset>",
    "",
  ].join("\n");
  res.type("application/xml").send(body);
});

app.use(express.static(PUBLIC_DIR));

app.get("/", (_req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

app.use((req, res) => {
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({ error: "Endpoint bulunamadı." });
  }
  return res.status(404).sendFile(path.join(PUBLIC_DIR, "404.html"));
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Sunucu hatası." });
});

if (require.main === module) {
  app.listen(port, () => {
    console.log(`Sunucu http://localhost:${port} adresinde çalışıyor`);
    if (!process.env.ADMIN_PASSWORD || !process.env.SESSION_SECRET) {
      console.log("Uyarı: ADMIN_PASSWORD ve/veya SESSION_SECRET tanımlı değil. Geliştirme varsayılanları kullanılıyor.");
    }
    if (NODE_ENV === "production" && !COOKIE_SECURE && COOKIE_SAMESITE !== "none") {
      console.log("Uyarı: Production ortamında COOKIE_SECURE=true önerilir.");
    }
  });
}

module.exports = app;
