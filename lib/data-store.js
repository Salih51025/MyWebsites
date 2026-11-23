const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const { Pool } = require("pg");

function sortProjects(projects) {
  return [...projects].sort((a, b) => {
    const ao = Number(a.order) || 0;
    const bo = Number(b.order) || 0;
    if (ao !== bo) return ao - bo;
    return String(a.createdAt || "").localeCompare(String(b.createdAt || ""));
  });
}

function createJsonDataStore({ dataDir, dataFile }) {
  function ensureStorage() {
    fs.mkdirSync(dataDir, { recursive: true });
    if (!fs.existsSync(dataFile)) {
      fs.writeFileSync(dataFile, "[]\n", "utf8");
    }
  }

  return {
    mode: "json",
    async init() {
      ensureStorage();
    },
    async readProjects() {
      ensureStorage();
      try {
        const raw = await fsp.readFile(dataFile, "utf8");
        const data = JSON.parse(raw || "[]");
        return Array.isArray(data) ? data : [];
      } catch (error) {
        if (error.code === "ENOENT") return [];
        throw error;
      }
    },
    async writeProjects(projects) {
      ensureStorage();
      const tmp = `${dataFile}.tmp`;
      await fsp.writeFile(tmp, JSON.stringify(projects, null, 2) + "\n", "utf8");
      await fsp.rename(tmp, dataFile);
    },
    async close() {},
  };
}

function createPostgresDataStore({ databaseUrl }) {
  const pool = new Pool({
    connectionString: databaseUrl,
    max: Number(process.env.PG_POOL_MAX || 5),
    ssl: process.env.PG_SSL === "false" ? false : { rejectUnauthorized: false },
  });

  let initPromise = null;

  async function init() {
    if (!initPromise) {
      initPromise = (async () => {
        await pool.query(`
          CREATE TABLE IF NOT EXISTS projects (
            id TEXT PRIMARY KEY,
            sort_order INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT '',
            doc JSONB NOT NULL,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )
        `);
        await pool.query(`
          CREATE INDEX IF NOT EXISTS projects_sort_idx ON projects (sort_order ASC, created_at ASC)
        `);
      })();
    }
    return initPromise;
  }

  return {
    mode: "postgres",
    init,
    async readProjects() {
      await init();
      const { rows } = await pool.query(
        "SELECT doc FROM projects ORDER BY sort_order ASC, created_at ASC, id ASC"
      );
      return rows.map((r) => r.doc).filter(Boolean);
    },
    async writeProjects(projects) {
      await init();
      const list = Array.isArray(projects) ? projects : [];
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query("DELETE FROM projects");
        if (list.length > 0) {
          const values = [];
          const placeholders = [];
          list.forEach((project, i) => {
            const base = i * 4;
            placeholders.push(`($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}::jsonb, NOW())`);
            values.push(
              String(project.id),
              Number(project.order) || 0,
              String(project.createdAt || ""),
              JSON.stringify(project)
            );
          });
          await client.query(
            `INSERT INTO projects (id, sort_order, created_at, doc, updated_at) VALUES ${placeholders.join(", ")}`,
            values
          );
        }
        await client.query("COMMIT");
      } catch (error) {
        try { await client.query("ROLLBACK"); } catch (_e) {}
        throw error;
      } finally {
        client.release();
      }
    },
    async close() {
      await pool.end();
    },
  };
}

function createDataStore({ databaseUrl, dataDir, dataFile }) {
  const dbUrl = (databaseUrl || "").trim();
  if (dbUrl) {
    return createPostgresDataStore({ databaseUrl: dbUrl });
  }
  return createJsonDataStore({ dataDir, dataFile });
}

module.exports = { createDataStore, sortProjects };
