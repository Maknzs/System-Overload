const express = require("express");
const { body, validationResult } = require("express-validator");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const isProbablyEmail = (v) => typeof v === "string" && v.includes("@");

const router = express.Router();
const SESSION_COOKIE = process.env.SESSION_COOKIE_NAME || 'so_session';
const isProd = process.env.NODE_ENV === 'production';

// POST /auth/register
router.post(
  "/register",
  body("email").isEmail(),
  body("username").isString().isLength({ min: 3 }),
  body("password").isString().isLength({ min: 8 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        ok: false,
        error: { code: "VALIDATION_ERROR", message: errors.array()[0].msg },
      });
    }
    const { password } = req.body;
    const username = (req.body.username || "").trim();
    const email = (req.body.email || "").trim().toLowerCase();
    try {
      const exists = await User.findOne({
        $or: [{ email }, { username }],
      }).lean();
      if (exists)
        return res.status(409).json({
          ok: false,
          error: {
            code: "ACCOUNT_EXISTS",
            message: "Email or username already in use",
          },
        });
      const passwordHash = await bcrypt.hash(password, 12);
      await User.create({ email, username, passwordHash, gamesPlayed: 0 });
      return res.status(201).json({ ok: true });
    } catch (e) {
      console.error(e);
      return res.status(500).json({
        ok: false,
        error: { code: "SERVER_ERROR", message: "Could not register" },
      });
    }
  }
);

// POST /auth/login
router.post(
  "/login",
  body("emailOrUsername").isString().notEmpty(),
  body("password").isString().isLength({ min: 8 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        ok: false,
        error: { code: "VALIDATION_ERROR", message: errors.array()[0].msg },
      });
    }
    const { password } = req.body;
    const emailOrUsername = (req.body.emailOrUsername || "").trim();
    try {
      let user;
      if (isProbablyEmail(emailOrUsername)) {
        const lowered = emailOrUsername.toLowerCase();
        user = await User.findOne({ email: lowered });
        if (!user) {
          // Fallback in case existing data stored mixed-case
          user = await User.findOne({ email: emailOrUsername });
        }
      } else {
        user = await User.findOne({ username: emailOrUsername });
      }
      if (!user)
        return res.status(401).json({
          ok: false,
          error: { code: "BAD_CREDENTIALS", message: "Invalid credentials" },
        });
      const ok = await bcrypt.compare(password, user.passwordHash);
      if (!ok)
        return res.status(401).json({
          ok: false,
          error: { code: "BAD_CREDENTIALS", message: "Invalid credentials" },
        });
      const token = jwt.sign(
        { sub: user.id, username: user.username },
        process.env.JWT_SECRET,
        { expiresIn: "24h" }
      );
      // Also set HttpOnly session cookie to begin migration to cookie-based auth
      const maxAgeSeconds = 24 * 60 * 60; // 24h
      res.cookie(SESSION_COOKIE, token, {
        httpOnly: true,
        secure: isProd,
        sameSite: isProd ? 'lax' : 'lax',
        maxAge: maxAgeSeconds * 1000,
        path: '/',
      });
      return res.json({
        ok: true,
        token,
        user: {
          email: user.email,
          username: user.username,
          gamesPlayed: user.gamesPlayed,
        },
      });
    } catch (e) {
      console.error(e);
      return res.status(500).json({
        ok: false,
        error: { code: "SERVER_ERROR", message: "Could not login" },
      });
    }
  }
);

// GET /auth/me
router.get("/me", async (req, res) => {
  // Expect Bearer token
  const h = req.headers.authorization || "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : null;
  // Fallback to cookie session if no Bearer provided (legacy or Better Auth)
  const cookieHeader = req.headers.cookie || '';
  let cookieToken = null;
  if (!token && cookieHeader) {
    try {
      cookieToken = cookieHeader.split(';').map(s => s.trim()).reduce((acc, pair) => {
        const idx = pair.indexOf('=');
        if (idx > -1) {
          const k = decodeURIComponent(pair.slice(0, idx));
          const v = decodeURIComponent(pair.slice(idx + 1));
          acc[k] = v;
        }
        return acc;
      }, {})[SESSION_COOKIE];
    } catch (_) {}
  }
  const tok = token || cookieToken;
  try {
    if (tok) {
      const payload = jwt.verify(tok, process.env.JWT_SECRET);
      const user = await User.findById(payload.sub).lean();
      if (!user)
        return res.status(404).json({ ok: false, error: { code: "NOT_FOUND", message: "User not found" } });
      return res.json({ ok: true, email: user.email, username: user.username, gamesPlayed: user.gamesPlayed });
    }
    // Try Better Auth session as a fallback
    const baCookie =
      (cookieHeader && cookieHeader.includes('better-auth.session_token')) ||
      (cookieHeader && cookieHeader.includes('__Secure-better-auth.session_token'));
    if (!baCookie) {
      return res.status(401).json({ ok: false, error: { code: "NO_TOKEN", message: "Missing token" } });
    }
    const base = `http://127.0.0.1:${process.env.PORT || 8080}`;
    const r = await fetch(`${base}/api/better-auth/session`, { headers: { cookie: cookieHeader } });
    if (!r.ok) throw new Error('no session');
    const body = await r.json();
    const u = body?.user || body?.session?.user;
    if (!u || !u.email) throw new Error('no user');
    const doc = await User.findOne({ email: String(u.email).toLowerCase() }).lean();
    if (!doc) return res.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: 'User not found' } });
    return res.json({ ok: true, email: doc.email, username: doc.username, gamesPlayed: doc.gamesPlayed });
  } catch (e) {
    return res.status(401).json({
      ok: false,
      error: { code: "BAD_TOKEN", message: "Invalid or expired token" },
    });
  }
});

// POST /auth/logout — clear cookie session (JWT tokens in clients remain unaffected)
router.post('/logout', (req, res) => {
  try {
    res.cookie(SESSION_COOKIE, '', {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'lax' : 'lax',
      expires: new Date(0),
      path: '/',
    });
  } catch (_) {}
  return res.json({ ok: true });
});

module.exports = router;
