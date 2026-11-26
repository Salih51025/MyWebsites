const crypto = require("crypto");
const rateLimit = require("express-rate-limit");
const {
  ADMIN_RATE_LIMIT_MAX,
  ADMIN_RATE_LIMIT_WINDOW_MS,
  LOGIN_RATE_LIMIT_MAX,
  LOGIN_RATE_LIMIT_WINDOW_MS,
} = require("./config");

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

module.exports = {
  getOrCreateCsrfToken,
  requireAdmin,
  requireCsrf,
  loginLimiter,
  adminApiLimiter,
};
