const path = require("path");
const { ADMIN_USER, ADMIN_PASSWORD } = require("./config");
const { requireAdmin, requireCsrf, getOrCreateCsrfToken, loginLimiter } = require("./security");
const { upload } = require("./upload");
const {
  cleanupMissingUploadReferences,
  cleanupOrphanUploads,
  getUploadUsageMap,
  listUploadFiles,
  normalizeProjectInput,
  normalizeText,
  readProjects,
  safeUnlink,
  sortProjects,
  validateProject,
  writeProjects,
} = require("./project-store");
const { UPLOAD_DIR } = require("./config");

function registerRoutes(app) {
  app.get("/api/projects", async (_req, res) => {
    try {
      const projects = sortProjects(await readProjects()).filter((p) => p.status !== "draft");
      res.json({ projects });
    } catch (_error) {
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
    } catch (_error) {
      res.status(500).json({ error: "Projeler okunamadı." });
    }
  });

  app.get("/api/admin/projects/:id", requireAdmin, async (req, res) => {
    try {
      const projects = await readProjects();
      const project = projects.find((p) => p.id === req.params.id);
      if (!project) return res.status(404).json({ error: "Proje bulunamadı." });
      res.json({ project });
    } catch (_error) {
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
    } catch (_error) {
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
    } catch (_error) {
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
    } catch (_error) {
      res.status(500).json({ error: "Proje silinemedi." });
    }
  });

  app.post("/api/admin/uploads", requireAdmin, requireCsrf, (req, res) => {
    upload.array("images", 20)(req, res, (err) => {
      if (err) {
        return res.status(400).json({ error: err.message || "Yükleme başarısız." });
      }
      const files = (req.files || []).map((file) => ({
        src: `/uploads/projects/${file.filename}`,
        filename: file.filename,
        originalName: file.originalname,
        size: file.size,
        mimetype: file.mimetype,
      }));
      res.status(201).json({ files });
    });
  });

  app.get("/api/admin/uploads", requireAdmin, async (_req, res) => {
    try {
      const projects = await readProjects();
      const files = await listUploadFiles(projects);
      res.json({ files });
    } catch (_error) {
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
        return res.status(409).json({
          error: "Bu görsel projelerde kullanılıyor. Önce projelerden kaldırın.",
          referencedBy: refs.slice(0, 10),
          referencedCount: refs.length,
        });
      }
      await safeUnlink(path.join(UPLOAD_DIR, filename));
      res.json({ ok: true, filename });
    } catch (_error) {
      res.status(500).json({ error: "Yükleme silinemedi." });
    }
  });

  app.post("/api/admin/uploads/cleanup", requireAdmin, requireCsrf, async (_req, res) => {
    try {
      const projects = await readProjects();
      const result = await cleanupOrphanUploads(projects);
      res.json({ ok: true, ...result });
    } catch (_error) {
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
    } catch (_error) {
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
    } catch (_error) {
      res.status(500).json({ error: "Sıralama güncellenemedi." });
    }
  });
}

module.exports = { registerRoutes };
