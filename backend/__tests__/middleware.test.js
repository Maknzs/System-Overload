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
});

