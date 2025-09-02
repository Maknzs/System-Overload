const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const User = require("../models/User");

const SESSION_COOKIE = process.env.SESSION_COOKIE_NAME || 'so_session';

function parseCookies(header) {
  const jar = {};
  if (!header) return jar;
  for (const part of String(header).split(';')) {
    const p = part.trim();
    if (!p) continue;
    const idx = p.indexOf('=');
    if (idx === -1) continue;
    const k = decodeURIComponent(p.slice(0, idx));
    const v = decodeURIComponent(p.slice(idx + 1));
    jar[k] = v;
  }
  return jar;
}

async function verifyJwt(req, res, next) {
  const h = req.headers.authorization || "";
  const bearer = h.startsWith("Bearer ") ? h.slice(7) : null;

  // 1) Try legacy JWT (header or our session cookie)
  let token = bearer;
  const cookies = parseCookies(req.headers.cookie || '');
  if (!token && cookies[SESSION_COOKIE]) token = cookies[SESSION_COOKIE];
  if (token) {
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      req.user = { id: payload.sub, username: payload.username };
      return next();
    } catch (_) {
      // fall through to Better Auth
    }
  }

  // 2) Try Better Auth session cookie via internal session endpoint
  try {
    const baCookie =
      cookies['better-auth.session_token'] ||
      cookies['__Secure-better-auth.session_token'];
    if (!baCookie) {
      return res.status(401).json({ ok: false, error: { code: 'NO_TOKEN', message: 'Missing token' } });
    }
    const base = `http://127.0.0.1:${process.env.PORT || 8080}`;
    const r = await fetch(`${base}/api/better-auth/session`, {
      method: 'GET',
      headers: {
        cookie: req.headers.cookie || '',
        'user-agent': req.get('user-agent') || '',
        'x-forwarded-for': req.ip || '',
      },
    });
    if (!r.ok) throw new Error(`session ${r.status}`);
    const body = await r.json();
    const u = body?.user || body?.session?.user;
    if (!u || !u.email) {
      return res.status(401).json({ ok: false, error: { code: 'BAD_TOKEN', message: 'Invalid session' } });
    }
    const email = String(u.email).toLowerCase();
    const doc = await User.findOne({ email });
    if (!doc) {
      return res.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: 'User not found' } });
    }
    req.user = { id: doc.id, username: doc.username };
    return next();
  } catch (e) {
    return res.status(401).json({
      ok: false,
      error: { code: "BAD_TOKEN", message: "Invalid or expired token" },
    });
  }
}

module.exports = { verifyJwt };
