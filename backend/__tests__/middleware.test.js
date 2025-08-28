const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');

const { verifyJwt } = require('../middleware/auth');

// Helper to build a tiny app using the middleware
function makeApp() {
  const app = express();
  app.get('/protected', verifyJwt, (req, res) => {
    return res.json({ ok: true, user: req.user });
  });
  return app;
}

describe('JWT middleware verifyJwt', () => {
  let app;
  const SECRET = process.env.JWT_SECRET || 'test-secret';

  beforeEach(() => {
    app = makeApp();
  });

  test('rejects when missing Authorization header', async () => {
    const res = await request(app).get('/protected');
    expect(res.status).toBe(401);
    expect(res.body.ok).toBe(false);
    expect(res.body.error && res.body.error.code).toBe('NO_TOKEN');
  });

  test('rejects when wrong scheme (not Bearer)', async () => {
    const res = await request(app)
      .get('/protected')
      .set('Authorization', 'Token abc123');
    expect(res.status).toBe(401);
    expect(res.body.error && res.body.error.code).toBe('NO_TOKEN');
  });

  test('rejects malformed token', async () => {
    const res = await request(app)
      .get('/protected')
      .set('Authorization', 'Bearer not-a-jwt');
    expect(res.status).toBe(401);
    expect(res.body.error && res.body.error.code).toBe('BAD_TOKEN');
  });

  test('rejects expired token', async () => {
    const expired = jwt.sign({ sub: 'u1', username: 'alice', exp: Math.floor(Date.now() / 1000) - 10 }, SECRET);
    const res = await request(app)
      .get('/protected')
      .set('Authorization', `Bearer ${expired}`);
    expect(res.status).toBe(401);
    expect(res.body.error && res.body.error.code).toBe('BAD_TOKEN');
  });

  test('rejects token signed with wrong secret', async () => {
    const wrong = jwt.sign({ sub: 'u1', username: 'alice' }, 'wrong-secret', { expiresIn: '1h' });
    const res = await request(app)
      .get('/protected')
      .set('Authorization', `Bearer ${wrong}`);
    expect(res.status).toBe(401);
    expect(res.body.error && res.body.error.code).toBe('BAD_TOKEN');
  });

  test('accepts valid token and sets req.user', async () => {
    const valid = jwt.sign({ sub: 'u1', username: 'alice' }, SECRET, { expiresIn: '1h' });
    const res = await request(app)
      .get('/protected')
      .set('Authorization', `Bearer ${valid}`);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.user).toEqual({ id: 'u1', username: 'alice' });
  });

  test('rejects token with tampered payload (invalid signature)', async () => {
    const good = jwt.sign({ sub: 'u1', username: 'alice' }, SECRET, { expiresIn: '1h' });
    // Tamper: change one character in payload segment
    const parts = good.split('.');
    const payload = parts[1];
    // Flip last char safely
    const tamperedPayload = payload.slice(0, -1) + (payload.slice(-1) === 'A' ? 'B' : 'A');
    const tampered = [parts[0], tamperedPayload, parts[2]].join('.');
    const res = await request(app)
      .get('/protected')
      .set('Authorization', `Bearer ${tampered}`);
    expect(res.status).toBe(401);
    expect(res.body.error && res.body.error.code).toBe('BAD_TOKEN');
  });

  test("rejects token with alg='none' (unsigned)", async () => {
    // Manually craft an unsigned JWT: header {alg:'none'}, empty signature
    function b64url(obj) {
      return Buffer.from(JSON.stringify(obj))
        .toString('base64')
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');
    }
    const header = { alg: 'none', typ: 'JWT' };
    const payload = { sub: 'u1', username: 'alice', iat: Math.floor(Date.now() / 1000) };
    const token = `${b64url(header)}.${b64url(payload)}.`; // empty signature
    const res = await request(app)
      .get('/protected')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
    expect(res.body.error && res.body.error.code).toBe('BAD_TOKEN');
  });
});
