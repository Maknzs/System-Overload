const request = require('supertest');
const mongoose = require('mongoose');

const app = require('../server');
const User = require('../models/User');

let MongoMemoryServer;
const hasMemServer = (() => {
  try {
    MongoMemoryServer = require('mongodb-memory-server').MongoMemoryServer;
    return true;
  } catch (_) {
    return false;
  }
})();

jest.setTimeout(60000);

function genCreds(n = 1) {
  return {
    email: `int${n}@example.com`,
    username: `intuser${n}`,
    password: `Password${n}!`,
  };
}

const suite = hasMemServer ? describe : describe.skip;
suite('Integration: Auth/Account with real MongoDB', () => {
  let mongo;
  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    const uri = mongo.getUri();
    await mongoose.connect(uri, { dbName: 'test' });
    await User.syncIndexes();
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongo) await mongo.stop();
  });

  beforeEach(async () => {
    // Clean users between tests
    await User.deleteMany({});
  });

  test('register enforces unique email/username (case-insensitive email at app level)', async () => {
    const u = genCreds(1);
    await request(app).post('/api/auth/register').send(u).expect(201);
    // Duplicate email different case should be blocked because server lowercases before save
    const dupEmail = { ...genCreds(2), email: u.email.toUpperCase() };
    const r1 = await request(app).post('/api/auth/register').send(dupEmail);
    expect(r1.status).toBe(409);
    // Duplicate username should be blocked by unique index
    const dupUsername = { ...genCreds(3), username: u.username };
    const r2 = await request(app).post('/api/auth/register').send(dupUsername);
    expect(r2.status).toBe(409);
  });

  test('login by mixed-case email works; /auth/me returns profile', async () => {
    const u = genCreds(4);
    await request(app).post('/api/auth/register').send(u).expect(201);
    const login = await request(app)
      .post('/api/auth/login')
      .send({ emailOrUsername: u.email.toUpperCase(), password: u.password })
      .expect(200);
    const token = login.body.token;
    const me = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(me.body.username).toBe(u.username);
  });

  test('token remains valid but /auth/me 404s after account deletion', async () => {
    const u = genCreds(5);
    await request(app).post('/api/auth/register').send(u).expect(201);
    const login = await request(app)
      .post('/api/auth/login')
      .send({ emailOrUsername: u.email, password: u.password })
      .expect(200);
    const token = login.body.token;
    // Delete via route
    await request(app)
      .delete('/api/account')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    // Token still verifies, but user is gone → 404
    const me = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
    expect(me.body.ok).toBe(false);
    expect(me.body.error && me.body.error.code).toBe('NOT_FOUND');
  });
});
