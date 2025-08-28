const request = require('supertest');
const jwt = require('jsonwebtoken');

jest.mock('../models/User');
const app = require('../server');
const User = require('../models/User');

function token(sub = 'u1', username = 'alice') {
  const secret = process.env.JWT_SECRET || 'test-secret';
  return jwt.sign({ sub, username }, secret, { expiresIn: '1h' });
}

describe('Server error paths (forced model throws)', () => {
  const originals = {};

  beforeEach(() => {
    // Snapshot originals so we can restore per-test
    originals.findOne = User.findOne;
    originals.create = User.create;
    originals.findById = User.findById;
    originals.findByIdAndDelete = User.findByIdAndDelete;
  });

  afterEach(() => {
    if (originals.findOne) User.findOne = originals.findOne;
    if (originals.create) User.create = originals.create;
    if (originals.findById) User.findById = originals.findById;
    if (originals.findByIdAndDelete) User.findByIdAndDelete = originals.findByIdAndDelete;
  });

  test('register: 500 when findOne throws', async () => {
    User.findOne = () => { throw new Error('boom'); };
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'a@example.com', username: 'alice', password: 'Password1!' });
    expect(res.status).toBe(500);
    expect(res.body.ok).toBe(false);
    expect(res.body.error && res.body.error.code).toBe('SERVER_ERROR');
  });

  test('register: 500 when create throws', async () => {
    User.create = async () => { throw new Error('db down'); };
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'b@example.com', username: 'bob', password: 'Password1!' });
    expect(res.status).toBe(500);
    expect(res.body.ok).toBe(false);
    expect(res.body.error && res.body.error.code).toBe('SERVER_ERROR');
  });

  test('login: 500 when findOne throws', async () => {
    User.findOne = () => { throw new Error('no db'); };
    const res = await request(app)
      .post('/api/auth/login')
      .send({ emailOrUsername: 'alice', password: 'Password1!' });
    expect(res.status).toBe(500);
    expect(res.body.ok).toBe(false);
    expect(res.body.error && res.body.error.code).toBe('SERVER_ERROR');
  });

  test('account email: 500 when findById throws', async () => {
    User.findById = () => { throw new Error('db error'); };
    const t = token('u1', 'alice');
    const res = await request(app)
      .put('/api/account/email')
      .set('Authorization', `Bearer ${t}`)
      .send({ newEmail: 'new@example.com', currentPassword: 'Password1!' });
    expect(res.status).toBe(500);
    expect(res.body.ok).toBe(false);
    expect(res.body.error && res.body.error.code).toBe('SERVER_ERROR');
  });

  test('account delete: 500 when findByIdAndDelete throws', async () => {
    User.findByIdAndDelete = () => { throw new Error('db delete failed'); };
    const t = token('u2', 'bob');
    const res = await request(app)
      .delete('/api/account')
      .set('Authorization', `Bearer ${t}`)
      .send();
    expect(res.status).toBe(500);
    expect(res.body.ok).toBe(false);
    expect(res.body.error && res.body.error.code).toBe('SERVER_ERROR');
  });
});

