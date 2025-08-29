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
    email: `Claims${n}@Example.com`, // intentionally mixed case
    username: `claimsuser${n}`,
    password: `Password${n}!`,
  };
}

describe('JWT claims and email normalization', () => {
  test('login token contains sub == _id and username; stored email is lowercased', async () => {
    const u = genCreds(1);

    // Register with mixed-case email
    await request(app).post('/api/auth/register').send(u).expect(201);

    // Verify stored email is lowercased
    const byUsername = await User.findOne({ username: u.username }).lean();
    expect(byUsername).toBeTruthy();
    expect(byUsername.email).toBe(u.email.toLowerCase());

    // Login (by uppercase email to exercise normalization)
    const login = await request(app)
      .post('/api/auth/login')
      .send({ emailOrUsername: u.email.toUpperCase(), password: u.password })
      .expect(200);

    const token = login.body.token;
    expect(typeof token).toBe('string');

    // Decode and verify claims
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    // Fetch the user to compare IDs
    const user = await User.findOne({ username: u.username });
    // Our mock sets id === _id (like Mongoose getter), route uses user.id for sub
    expect(payload.sub).toBe(user.id);
    expect(payload.sub).toBe(user._id);
    expect(payload.username).toBe(u.username);
  });
});

