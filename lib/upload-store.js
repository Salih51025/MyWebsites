const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const crypto = require("crypto");
const multer = require("multer");
const { put, del, list } = require("@vercel/blob");

function safeName(originalName = "") {
  const ext = path.extname(originalName).toLowerCase();
  return [".jpg", ".jpeg", ".png", ".webp", ".gif"].includes(ext) ? ext : ".png";
}

function createLocalUploadStore({ uploadDir }) {
  function ensureDir() {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  return {
    mode: "local",
    async init() { ensureDir(); },
    multerStorage() {
      ensureDir();
      return multer.diskStorage({
        destination: (_req, _file, cb) => cb(null, uploadDir),
        filename: (_req, file, cb) => {
          cb(null, `${Date.now()}-${crypto.randomBytes(4).toString("hex")}${safeName(file.originalname)}`);
        },
      });
    },
    async finalizeUpload(file) {
      // file already on disk; return src
      return {
        src: `/uploads/projects/${file.filename}`,
        filename: file.filename,
        originalName: file.originalname,
        size: file.size,
        mimetype: file.mimetype,
        path: file.path,
      };
    },
    async removeBySrc(src) {
      const filename = path.basename(String(src || ""));
      if (!filename) return;
      const filePath = path.join(uploadDir, filename);
      await fsp.unlink(filePath).catch((err) => { if (err.code !== "ENOENT") throw err; });
    },
    async listFiles() {
      ensureDir();
      let names = [];
      try { names = await fsp.readdir(uploadDir); } catch (_e) { names = []; }
      const items = await Promise.all(names.map(async (name) => {
        const filePath = path.join(uploadDir, name);
        let stat = null;
        try { stat = await fsp.stat(filePath); } catch (_e) { stat = null; }
        return {
          filename: name,
          src: `/uploads/projects/${name}`,
          size: stat ? stat.size : null,
          mtime: stat ? stat.mtime.toISOString() : null,
        };
      }));
      return items;
    },
    isManagedSrc(src) {
      return typeof src === "string" && src.startsWith("/uploads/projects/");
    },
    srcToKey(src) {
      if (typeof src !== "string" || !src.startsWith("/uploads/projects/")) return null;
      return path.basename(src);
    },
  };
}

function createBlobUploadStore({ token }) {
  const prefix = "projects/";

  function keyFromSrc(src) {
    if (typeof src !== "string" || !src) return null;
    try {
      const url = new URL(src);
      // vercel blob public url: https://<store>.public.blob.vercel-storage.com/<pathname>
      const pathname = url.pathname.replace(/^\/+/, "");
      if (pathname.startsWith(prefix)) return pathname;
      // allow any blob vercel storage url that has projects/ in it
      const idx = pathname.indexOf(prefix);
      if (idx >= 0) return pathname.slice(idx);
      return null;
    } catch (_e) {
      return null;
    }
  }

  return {
    mode: "blob",
    async init() {},
    multerStorage() {
      return multer.memoryStorage();
    },
    async finalizeUpload(file) {
      const ext = safeName(file.originalname);
      const filename = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}${ext}`;
      const pathname = `${prefix}${filename}`;
      const blob = await put(pathname, file.buffer, {
        access: "public",
        contentType: file.mimetype || "application/octet-stream",
        token,
        addRandomSuffix: false,
      });
      return {
        src: blob.url,
        filename, // keep short filename for admin UI/delete key compatibility
        pathname: blob.pathname,
        originalName: file.originalname,
        size: file.size,
        mimetype: file.mimetype,
        url: blob.url,
      };
    },
    async removeBySrc(src) {
      const key = keyFromSrc(src);
      if (!key) {
        // try deleting by src directly if it's a full blob url
        if (typeof src === "string" && src.startsWith("https://")) {
          await del(src, { token }).catch(() => {});
        }
        return;
      }
      // del supports url or pathname? @vercel/blob del takes url(s). We should find by list or delete by constructed url.
      // Easier: list and match pathname, then del url. Or del the src if it's URL.
      if (typeof src === "string" && src.startsWith("https://")) {
        await del(src, { token });
        return;
      }
      // fallback: list and find
      const listed = await list({ prefix: key, token, limit: 10 });
      const match = (listed.blobs || []).find((b) => b.pathname === key);
      if (match) await del(match.url, { token });
    },
    async listFiles() {
      const blobs = [];
      let cursor;
      do {
        const res = await list({ prefix, token, cursor, limit: 1000 });
        blobs.push(...(res.blobs || []));
        cursor = res.hasMore ? res.cursor : undefined;
      } while (cursor);
      return blobs.map((b) => {
        const pathname = b.pathname || "";
        const filename = pathname.startsWith(prefix) ? pathname.slice(prefix.length) : path.basename(pathname);
        return {
          filename,
          pathname,
          src: b.url,
          size: b.size ?? null,
          mtime: b.uploadedAt ? new Date(b.uploadedAt).toISOString() : null,
        };
      });
    },
    isManagedSrc(src) {
      if (typeof src !== "string") return false;
      if (src.startsWith("/uploads/projects/")) return true;
      return !!keyFromSrc(src);
    },
    srcToKey(src) {
      const key = keyFromSrc(src);
      if (key) return key.startsWith(prefix) ? key.slice(prefix.length) : path.basename(key);
      if (typeof src === "string" && src.startsWith("/uploads/projects/")) return path.basename(src);
      return null;
    },
  };
}

function createUploadStore({ blobToken, uploadDir }) {
  const token = (blobToken || "").trim();
  if (token) return createBlobUploadStore({ token });
  return createLocalUploadStore({ uploadDir });
}

module.exports = { createUploadStore };
