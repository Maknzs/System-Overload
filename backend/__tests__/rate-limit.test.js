const request = require('supertest');

describe('Rate limiting', () => {
  let app;
  const AUTH_MAX = 100;
  const ACCOUNT_MAX = 200;
  const WINDOW = 15 * 60 * 1000; // 15 minutes

  beforeAll(() => {
    // Use fake timers so we can advance the window
    jest.useFakeTimers();
    // Require app after enabling fake timers so any internal timers (stores) are faked
    // eslint-disable-next-line global-require
    app = require('../server');
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  test(`/api/auth limited after ${AUTH_MAX} requests`, async () => {
    // Send AUTH_MAX requests within the window
    for (let i = 0; i < AUTH_MAX; i++) {
      const r = await request(app)
        .post('/api/auth/login')
        .send({ emailOrUsername: 'x', password: 'short' }); // trigger 400 validation
      expect(r.status).toBe(400);
    }
    // Next one should be 429 Too Many Requests
    const limited = await request(app)
      .post('/api/auth/login')
      .send({ emailOrUsername: 'x', password: 'short' });
    expect(limited.status).toBe(429);

    // Advance time beyond window and try again -> should not be 429
    jest.advanceTimersByTime(WINDOW + 1000);
    const afterWindow = await request(app)
      .post('/api/auth/login')
      .send({ emailOrUsername: 'x', password: 'short' });
    expect(afterWindow.status).toBe(400);
  });

  test(`\n/api/account limited after ${ACCOUNT_MAX} requests`, async () => {
    // Flood any account path; limiter is attached to the prefix
    for (let i = 0; i < ACCOUNT_MAX; i++) {
      const r = await request(app).get('/api/account/anything');
      // 404 is fine; we only care the request passes until limit
      expect([401, 404, 400]).toContain(r.status);
    }
    const limited = await request(app).get('/api/account/anything');
    expect(limited.status).toBe(429);

    // Advance timers to reset
    jest.advanceTimersByTime(WINDOW + 1000);
    const afterWindow = await request(app).get('/api/account/anything');
    expect([401, 404, 400]).toContain(afterWindow.status);
  });
});

