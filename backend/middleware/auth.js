const jwt = require("jsonwebtoken");

function verifyJwt(req, res, next) {
  const h = req.headers.authorization || "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : null;
  if (!token)
    return res.status(401).json({
      ok: false,
      error: { code: "NO_TOKEN", message: "Missing token" },
    });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: payload.sub, username: payload.username };
    next();
  } catch (e) {
    return res.status(401).json({
      ok: false,
      error: { code: "BAD_TOKEN", message: "Invalid or expired token" },
    });
  }
}

module.exports = { verifyJwt };
