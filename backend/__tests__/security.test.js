const request = require('supertest');
const app = require('../server');

describe('Security headers (helmet)', () => {
  test('GET /api/health has key security headers', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    // Core helmet headers that should be present
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
    expect(res.headers['x-dns-prefetch-control']).toBe('off');
    // IE download option header
    expect(res.headers['x-download-options']).toBe('noopen');
    // Hide powered by
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});

