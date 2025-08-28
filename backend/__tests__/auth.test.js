const request = require('supertest');
const jwt = require('jsonwebtoken');
jest.mock('../models/User');
const app = require('../server');
const User = require('../models/User');

beforeEach(() => {
  if (typeof User.__reset === 'function') User.__reset();
});

function genCreds(n = 1) {
  return {
    email: `user${n}@example.com`,
    username: `user${n}`,
    password: `Password${n}!`,
  };
}

describe('Auth routes', () => {
  describe('validation', () => {
    test('register: invalid email', async () => {
      const u = { email: 'not-an-email', username: 'userx', password: 'Password1!' };
      const res = await request(app).post('/api/auth/register').send(u);
      expect(res.status).toBe(400);
      expect(res.body.ok).toBe(false);
    });

    test('register: short username', async () => {
      const u = { email: 'userx@example.com', username: 'ab', password: 'Password1!' };
      const res = await request(app).post('/api/auth/register').send(u);
      expect(res.status).toBe(400);
      expect(res.body.ok).toBe(false);
    });

    test('register: short password', async () => {
      const u = { email: 'userx2@example.com', username: 'userx2', password: 'short' };
      const res = await request(app).post('/api/auth/register').send(u);
      expect(res.status).toBe(400);
      expect(res.body.ok).toBe(false);
    });

    test('login: missing emailOrUsername', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ password: 'Password1!' });
      expect(res.status).toBe(400);
      expect(res.body.ok).toBe(false);
    });

    test('login: short password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ emailOrUsername: 'someone', password: 'short' });
      expect(res.status).toBe(400);
      expect(res.body.ok).toBe(false);
    });

    test('login: empty strings', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ emailOrUsername: '', password: '' });
      expect(res.status).toBe(400);
      expect(res.body.ok).toBe(false);
    });
  });
  test('register: creates new account', async () => {
    const u = genCreds(1);
    const res = await request(app).post('/api/auth/register').send(u);
    expect(res.status).toBe(201);
    expect(res.body.ok).toBe(true);
  });

  test('register: rejects duplicate email/username', async () => {
    const u = genCreds(2);
    await request(app).post('/api/auth/register').send(u).expect(201);
    const dupEmail = { ...genCreds(3), email: u.email };
    const dupUsername = { ...genCreds(4), username: u.username };
    const r1 = await request(app).post('/api/auth/register').send(dupEmail);
    const r2 = await request(app).post('/api/auth/register').send(dupUsername);
    expect([r1.status, r2.status]).toEqual([409, 409]);
    expect(r1.body.ok).toBe(false);
    expect(r2.body.ok).toBe(false);
  });

  test('login: by email and username, returns token and user', async () => {
    const u = genCreds(5);
    await request(app).post('/api/auth/register').send(u).expect(201);
    const byEmail = await request(app)
      .post('/api/auth/login')
      .send({ emailOrUsername: u.email, password: u.password });
    expect(byEmail.status).toBe(200);
    expect(byEmail.body.ok).toBe(true);
    expect(typeof byEmail.body.token).toBe('string');
    expect(byEmail.body.user.username).toBe(u.username);

    const byUsername = await request(app)
      .post('/api/auth/login')
      .send({ emailOrUsername: u.username, password: u.password });
    expect(byUsername.status).toBe(200);
    expect(byUsername.body.ok).toBe(true);
  });

  test('login: invalid credentials', async () => {
    const bad = await request(app)
      .post('/api/auth/login')
      .send({ emailOrUsername: 'nouser', password: 'Password1!' });
    expect(bad.status).toBe(401);
    expect(bad.body.ok).toBe(false);
  });

  test('me: requires valid token and returns profile', async () => {
    const u = genCreds(6);
    await request(app).post('/api/auth/register').send(u).expect(201);
    const login = await request(app)
      .post('/api/auth/login')
      .send({ emailOrUsername: u.email, password: u.password });
    const token = login.body.token;
    const me = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(me.status).toBe(200);
    expect(me.body.ok).toBe(true);
    expect(me.body.username).toBe(u.username);

    // Bad token
    const bad = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer invalid');
    expect(bad.status).toBe(401);
  });
});
