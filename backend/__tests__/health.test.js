const request = require('supertest');
jest.mock('../models/User');
const app = require('../server');
const User = require('../models/User');

beforeEach(() => {
  if (typeof User.__reset === 'function') User.__reset();
});

describe('Health endpoint', () => {
  it('GET /api/health returns ok: true', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});
