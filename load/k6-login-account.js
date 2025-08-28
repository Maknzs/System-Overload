import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 1,
  iterations: 3,
  thresholds: {
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<1000'],
  },
};

const BASE = __ENV.API_BASE || 'http://localhost:8080/api';

function uniq() {
  return `${Date.now()}_${__VU}_${__ITER}`;
}

export default function () {
  const email = `k6_${uniq()}@example.com`;
  const username = `k6user_${uniq()}`;
  const password = 'Password1!';

  // Register (allow 201 or 409 in case of rare collision)
  let res = http.post(
    `${BASE}/auth/register`,
    JSON.stringify({ email, username, password }),
    { headers: { 'Content-Type': 'application/json' } }
  );
  check(res, { 'register ok': (r) => r.status === 201 || r.status === 409 });

  // Login
  res = http.post(
    `${BASE}/auth/login`,
    JSON.stringify({ emailOrUsername: email, password }),
    { headers: { 'Content-Type': 'application/json' } }
  );
  check(res, { 'login 200': (r) => r.status === 200 });
  const token = res.json('token');

  // Authorized account call: games-played
  const auth = { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } };
  const gp = http.post(`${BASE}/account/games-played`, null, auth);
  check(gp, { 'games-played 200': (r) => r.status === 200 });

  sleep(0.2);
}

