const path = require("path");

const ROOT_DIR = path.join(__dirname, "..");
const DATA_DIR = path.join(ROOT_DIR, "data");
const DATA_FILE = path.join(DATA_DIR, "projects.json");
const PUBLIC_DIR = path.join(ROOT_DIR, "public");
const UPLOAD_DIR = path.join(PUBLIC_DIR, "uploads", "projects");

function parseBool(value, fallback = false) {
  if (value == null || value === "") return fallback;
  const v = String(value).toLowerCase();
  if (["1", "true", "yes", "on"].includes(v)) return true;
  if (["0", "false", "no", "off"].includes(v)) return false;
  return fallback;
}

function toInt(value, fallback) {
  const n = parseInt(value, 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

const NODE_ENV = process.env.NODE_ENV || "development";
const COOKIE_SAMESITE = (process.env.COOKIE_SAMESITE || "lax").toLowerCase();
const COOKIE_SECURE = (() => {
  if (process.env.COOKIE_SECURE != null && process.env.COOKIE_SECURE !== "") {
    return parseBool(process.env.COOKIE_SECURE, false);
  }
  return NODE_ENV === "production";
})();

module.exports = {
  ROOT_DIR,
  DATA_DIR,
  DATA_FILE,
  PUBLIC_DIR,
  UPLOAD_DIR,
  PORT: process.env.PORT || 8080,
  ADMIN_USER: process.env.ADMIN_USER || "admin",
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || "admin123",
  SESSION_SECRET: process.env.SESSION_SECRET || "change-this-session-secret",
  NODE_ENV,
  TRUST_PROXY: process.env.TRUST_PROXY,
  COOKIE_SECURE,
  COOKIE_SAMESITE,
  LOGIN_RATE_LIMIT_WINDOW_MS: toInt(process.env.LOGIN_RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
  LOGIN_RATE_LIMIT_MAX: toInt(process.env.LOGIN_RATE_LIMIT_MAX, 10),
  ADMIN_RATE_LIMIT_WINDOW_MS: toInt(process.env.ADMIN_RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
  ADMIN_RATE_LIMIT_MAX: toInt(process.env.ADMIN_RATE_LIMIT_MAX, 300),
  parseBool,
  toInt,
};
