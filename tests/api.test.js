const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const TMP_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), "mywebsites-test-"));
const DATA_DIR = path.join(TMP_ROOT, "data");
const UPLOAD_DIR = path.join(TMP_ROOT, "uploads", "projects");
const PUBLIC_DIR = path.join(ROOT, "public");
const DATA_FILE = path.join(DATA_DIR, "projects.json");

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
fs.writeFileSync(DATA_FILE, "[]\n", "utf8");

process.env.NODE_ENV = "test";
process.env.PORT = "0";
process.env.ADMIN_USER = "admin";
process.env.ADMIN_PASSWORD = "test-password";
process.env.SESSION_SECRET = "test-session-secret";
process.env.COOKIE_SECURE = "false";
process.env.DATA_DIR = DATA_DIR;
process.env.DATA_FILE = DATA_FILE;
process.env.UPLOAD_DIR = UPLOAD_DIR;
process.env.PUBLIC_DIR = PUBLIC_DIR;

const app = require(path.join(ROOT, "server.js"));

let server;
let baseUrl;

function getSetCookies(res) {
  if (typeof res.headers.getSetCookie === "function") return res.headers.getSetCookie();
  const value = res.headers.get("set-cookie");
  return value ? [value] : [];
}

function mergeCookies(jar, res) {
  for (const cookie of getSetCookies(res)) {
    const pair = cookie.split(";")[0];
    const idx = pair.indexOf("=");
    if (idx > 0) jar.set(pair.slice(0, idx), pair.slice(idx + 1));
  }
}

function cookieHeader(jar) {
  return Array.from(jar.entries()).map(([k, v]) => `${k}=${v}`).join("; ");
}

async function request(jar, pathname, options = {}) {
  const headers = { ...(options.headers || {}) };
  const cookie = cookieHeader(jar);
  if (cookie) headers.Cookie = cookie;
  const res = await fetch(`${baseUrl}${pathname}`, { ...options, headers });
  mergeCookies(jar, res);
  const contentType = res.headers.get("content-type") || "";
  const body = contentType.includes("application/json") ? await res.json() : await res.text();
  return { res, body };
}

async function getCsrf(jar) {
  const { res, body } = await request(jar, "/api/admin/csrf");
  assert.equal(res.status, 200);
  assert.ok(body.csrfToken);
  return body.csrfToken;
}

async function login(jar) {
  const csrf = await getCsrf(jar);
  const { res, body } = await request(jar, "/api/admin/login", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf },
    body: JSON.stringify({ username: "admin", password: "test-password" }),
  });
  assert.equal(res.status, 200);
  assert.equal(body.ok, true);
  return body.csrfToken || csrf;
}

test.before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
});

test.after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  await fsp.rm(TMP_ROOT, { recursive: true, force: true });
});

test("GET /api/health returns healthy", async () => {
  const jar = new Map();
  const { res, body } = await request(jar, "/api/health");
  assert.equal(res.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.status, "healthy");
});

test("GET /api/projects returns empty list initially", async () => {
  const jar = new Map();
  const { res, body } = await request(jar, "/api/projects");
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(body.projects));
});

test("admin auth + project CRUD + reorder smoke", async () => {
  const jar = new Map();

  const meBefore = await request(jar, "/api/admin/me");
  assert.equal(meBefore.res.status, 401);

  const csrf = await login(jar);

  const meAfter = await request(jar, "/api/admin/me");
  assert.equal(meAfter.res.status, 200);
  assert.equal(meAfter.body.authenticated, true);

  const createPayload = {
    order: 1,
    numberLabel: "01",
    status: "published",
    category: { en: "Web", tr: "Web" },
    title: { en: "Test Project", tr: "Test Proje" },
    description: { en: ["English desc"], tr: ["Turkce aciklama"] },
    images: [{ src: "/uploads/projects/test.png", alt: { en: "alt", tr: "alt" } }],
  };

  const created = await request(jar, "/api/admin/projects", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf },
    body: JSON.stringify(createPayload),
  });
  assert.equal(created.res.status, 201);
  assert.ok(created.body.project.id);
  const id = created.body.project.id;

  const listed = await request(jar, "/api/admin/projects");
  assert.equal(listed.res.status, 200);
  assert.ok(listed.body.projects.some((p) => p.id === id));

  const updated = await request(jar, `/api/admin/projects/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf },
    body: JSON.stringify({ ...createPayload, title: { en: "Updated", tr: "Guncel" } }),
  });
  assert.equal(updated.res.status, 200);
  assert.equal(updated.body.project.title.en, "Updated");

  const create2 = await request(jar, "/api/admin/projects", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf },
    body: JSON.stringify({ ...createPayload, order: 2, numberLabel: "02", title: { en: "Second", tr: "Ikinci" } }),
  });
  assert.equal(create2.res.status, 201);
  const id2 = create2.body.project.id;

  const reorder = await request(jar, "/api/admin/projects/reorder", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf },
    body: JSON.stringify({ items: [{ id: id2 }, { id }] }),
  });
  assert.equal(reorder.res.status, 200);
  assert.equal(reorder.body.ok, true);

  const publicList = await request(jar, "/api/projects");
  assert.equal(publicList.res.status, 200);
  assert.equal(publicList.body.projects[0].id, id2);

  const del = await request(jar, `/api/admin/projects/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: { "X-CSRF-Token": csrf },
  });
  assert.equal(del.res.status, 200);
  assert.equal(del.body.ok, true);
});

test("admin endpoints require auth", async () => {
  const jar = new Map();
  const { res } = await request(jar, "/api/admin/projects");
  assert.equal(res.status, 401);
});

test("unknown API route returns 404 JSON", async () => {
  const jar = new Map();
  const { res, body } = await request(jar, "/api/does-not-exist");
  assert.equal(res.status, 404);
  assert.equal(body.error, "Endpoint bulunamadı.");
});

test("unknown page returns 404 HTML", async () => {
  const jar = new Map();
  const { res, body } = await request(jar, "/this-page-does-not-exist");
  assert.equal(res.status, 404);
  assert.match(String(body), /404/);
});

test("robots and sitemap are served", async () => {
  const jar = new Map();
  const robots = await request(jar, "/robots.txt");
  assert.equal(robots.res.status, 200);
  assert.match(String(robots.body), /Sitemap:/);

  const sitemap = await request(jar, "/sitemap.xml");
  assert.equal(sitemap.res.status, 200);
  assert.match(String(sitemap.body), /<urlset/);
});
