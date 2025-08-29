import { test, expect } from '@playwright/test';

test('Login shows helpful error after rate limit (429)', async ({ page, request }) => {
  // Rapidly consume the /api/auth limiter by firing many bad logins directly
  const url = 'http://localhost:8080/api/auth/login';
  const body = { emailOrUsername: 'someone@example.com', password: 'Password1!' };
  const headers = { 'x-e2e-key': `rl-${Date.now()}-${Math.random()}` };

  // Fire a burst larger than the default limit (100)
  const burst = 120;
  await Promise.all(
    Array.from({ length: burst }, () =>
      request.post(url, { data: body, headers }).catch(() => null)
    )
  );

  // Now attempt via UI and assert a helpful message appears
  await page.goto('/login');
  await page.getByPlaceholder(/email or username/i).fill(body.emailOrUsername);
  await page.getByPlaceholder(/password/i).fill(body.password);
  await page.getByRole('button', { name: /login/i }).click();

  // Our api.js surfaces either the server message or HTTP 429
  const err = page.getByText(/too many requests|429/i);
  await expect(err).toBeVisible();
});
