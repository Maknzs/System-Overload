const request = require('supertest');
jest.mock('../models/User');
const app = require('../server');
const User = require('../models/User');

beforeEach(() => {
  if (typeof User.__reset === 'function') User.__reset();
});

function genCreds(n = 1) {
  return {
    email: `acct${n}@example.com`,
    username: `acct${n}`,
    password: `Password${n}!`,
  };
}

async function createAndLogin(n = 1) {
  const u = genCreds(n);
  await request(app).post('/api/auth/register').send(u).expect(201);
  const login = await request(app)
    .post('/api/auth/login')
    .send({ emailOrUsername: u.email, password: u.password })
    .expect(200);
  return { ...u, token: login.body.token };
}

describe('Account routes', () => {
  describe('validation', () => {
    test('update email: invalid email', async () => {
      const { token, password } = await createAndLogin(10);
      const res = await request(app)
        .put('/api/account/email')
        .set('Authorization', `Bearer ${token}`)
        .send({ newEmail: 'not-an-email', currentPassword: password });
      expect(res.status).toBe(400);
      expect(res.body.ok).toBe(false);
    });

    test('update username: too short', async () => {
      const { token, password } = await createAndLogin(11);
      const res = await request(app)
        .put('/api/account/username')
        .set('Authorization', `Bearer ${token}`)
        .send({ newUsername: 'ab', currentPassword: password });
      expect(res.status).toBe(400);
      expect(res.body.ok).toBe(false);
    });

    test('update password: short newPassword', async () => {
      const { token, password } = await createAndLogin(12);
      const res = await request(app)
        .put('/api/account/password')
        .set('Authorization', `Bearer ${token}`)
        .send({ currentPassword: password, newPassword: 'short' });
      expect(res.status).toBe(400);
      expect(res.body.ok).toBe(false);
    });

    test('update password: missing fields', async () => {
      const { token } = await createAndLogin(13);
      const res = await request(app)
        .put('/api/account/password')
        .set('Authorization', `Bearer ${token}`)
        .send({});
      expect(res.status).toBe(400);
      expect(res.body.ok).toBe(false);
    });
  });

  test('update email', async () => {
    const { token, password } = await createAndLogin(1);
    const res = await request(app)
      .put('/api/account/email')
      .set('Authorization', `Bearer ${token}`)
      .send({ newEmail: 'new1@example.com', currentPassword: password });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  test('update username', async () => {
    const { token, password } = await createAndLogin(2);
    const res = await request(app)
      .put('/api/account/username')
      .set('Authorization', `Bearer ${token}`)
      .send({ newUsername: 'updatedUser2', currentPassword: password });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  test('update password and prevent reuse', async () => {
    const { token, password, email } = await createAndLogin(3);
    const newPassword = 'NewPass3!';
    const res = await request(app)
      .put('/api/account/password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: password, newPassword });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);

    // Reuse same password should fail
    const reuse = await request(app)
      .put('/api/account/password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: newPassword, newPassword });
    expect(reuse.status).toBe(400);

    // Login with new password works
    const login = await request(app)
      .post('/api/auth/login')
      .send({ emailOrUsername: email, password: newPassword });
    expect(login.status).toBe(200);
    expect(login.body.ok).toBe(true);
  });

  test('games-played increments', async () => {
    const { token } = await createAndLogin(4);
    const r1 = await request(app)
      .post('/api/account/games-played')
      .set('Authorization', `Bearer ${token}`)
      .send();
    expect(r1.status).toBe(200);
    expect(r1.body.gamesPlayed).toBe(1);
    const r2 = await request(app)
      .post('/api/account/games-played')
      .set('Authorization', `Bearer ${token}`)
      .send();
    expect(r2.status).toBe(200);
    expect(r2.body.gamesPlayed).toBe(2);
  });

  test('delete account', async () => {
    const { token, email, password } = await createAndLogin(5);
    const del = await request(app)
      .delete('/api/account')
      .set('Authorization', `Bearer ${token}`)
      .send();
    expect(del.status).toBe(200);
    expect(del.body.ok).toBe(true);
    const relogin = await request(app)
      .post('/api/auth/login')
      .send({ emailOrUsername: email, password });
    expect(relogin.status).toBe(401);
  });

  test('auth required middleware', async () => {
    const res = await request(app)
      .put('/api/account/email')
      .send({ newEmail: 'x@example.com', currentPassword: 'Password1!' });
    expect(res.status).toBe(401);
    expect(res.body.ok).toBe(false);
  });
});
