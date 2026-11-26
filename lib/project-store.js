const crypto = require("crypto");
const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const { DATA_DIR, DATA_FILE, UPLOAD_DIR } = require("./config");

function ensureStorage() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, "[]\n", "utf8");
  }
}

async function readProjects() {
  ensureStorage();
  try {
    const raw = await fsp.readFile(DATA_FILE, "utf8");
    const data = JSON.parse(raw || "[]");
    return Array.isArray(data) ? data : [];
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

async function writeProjects(projects) {
  ensureStorage();
  const tmp = `${DATA_FILE}.tmp`;
  await fsp.writeFile(tmp, JSON.stringify(projects, null, 2) + "\n", "utf8");
  await fsp.rename(tmp, DATA_FILE);
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

function safeUnlink(filePath) {
  return fsp.unlink(filePath).catch((err) => {
    if (err && err.code === "ENOENT") return;
    console.warn("Dosya silinemedi:", filePath, err.message);
  });
}

function getUploadUsageMap(projects) {
  const usage = new Map();
  (projects || []).forEach((p) => {
    (p.images || []).forEach((img) => {
      const src = normalizeText(img && img.src);
      if (!src.startsWith("/uploads/projects/")) return;
      const filename = path.basename(src);
      if (!usage.has(filename)) usage.set(filename, []);
      usage.get(filename).push({ projectId: p.id, projectTitle: p.title && (p.title.tr || p.title.en) || "" });
    });
  });
  return usage;
}

async function listUploadFiles(projects) {
  ensureStorage();
  const usage = getUploadUsageMap(projects);
  let names = [];
  try {
    names = await fsp.readdir(UPLOAD_DIR);
  } catch (_e) {
    names = [];
  }
  const items = await Promise.all(names.map(async (name) => {
    const filePath = path.join(UPLOAD_DIR, name);
    let stat = null;
    try { stat = await fsp.stat(filePath); } catch (_e) { stat = null; }
    const refs = usage.get(name) || [];
    return {
      filename: name,
      src: `/uploads/projects/${name}`,
      size: stat ? stat.size : null,
      mtime: stat ? stat.mtime.toISOString() : null,
      referencedCount: refs.length,
      referencedBy: refs.slice(0, 5),
      isReferenced: refs.length > 0,
    };
  }));
  items.sort((a, b) => String(b.mtime || "").localeCompare(String(a.mtime || "")));
  return items;
}

async function cleanupOrphanUploads(projects) {
  ensureStorage();
  const used = new Set();
  (projects || []).forEach((p) => {
    (p.images || []).forEach((img) => {
      const src = normalizeText(img && img.src);
      if (src.startsWith("/uploads/projects/")) {
        used.add(path.basename(src));
      }
    });
  });
  let files = [];
  try {
    files = await fsp.readdir(UPLOAD_DIR);
  } catch (_e) {
    return { removed: 0, scanned: 0 };
  }
  let removed = 0;
  for (const name of files) {
    if (!used.has(name)) {
      await safeUnlink(path.join(UPLOAD_DIR, name));
      removed += 1;
    }
  }
  return { removed, scanned: files.length };
}

async function cleanupMissingUploadReferences(projects) {
  ensureStorage();
  let files = [];
  try {
    files = await fsp.readdir(UPLOAD_DIR);
  } catch (_e) {
    files = [];
  }
  const existing = new Set(files);
  let removedReferences = 0;
  let affectedProjects = 0;

  (projects || []).forEach((project) => {
    const before = Array.isArray(project.images) ? project.images.length : 0;
    const filtered = (project.images || []).filter((img) => {
      const src = normalizeText(img && img.src);
      if (!src.startsWith("/uploads/projects/")) return true;
      const filename = path.basename(src);
      const keep = existing.has(filename);
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

module.exports = {
  ensureStorage,
  readProjects,
  writeProjects,
  normalizeText,
  normalizeParagraphs,
  normalizeImages,
  normalizeProjectInput,
  validateProject,
  sortProjects,
  safeUnlink,
  getUploadUsageMap,
  listUploadFiles,
  cleanupOrphanUploads,
  cleanupMissingUploadReferences,
};
