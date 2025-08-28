import { test, expect } from '@playwright/test';
import jwt from 'jsonwebtoken';

test('Bogus token in storage redirects to Login and clears token', async ({ page }) => {
  await page.addInitScript(() => {
    // @ts-ignore
    window.localStorage.setItem('token', 'bogus-token');
  });
  await page.goto('/');
  await expect(page).toHaveURL(/\/login$/);
  // Ensure token cleared by app
  const token = await page.evaluate(() => localStorage.getItem('token'));
  expect(token).toBeNull();
});

test('Expired token triggers 401 handling and redirect to Login', async ({ page }) => {
  // Backend memory launcher uses JWT_SECRET='e2e-secret' by default
  const secret = 'e2e-secret';
  const expired = jwt.sign(
    { sub: 'u1', username: 'someone', exp: Math.floor(Date.now() / 1000) - 60 },
    secret
  );

  await page.addInitScript((t) => {
    // @ts-ignore
    window.localStorage.setItem('token', t);
  }, expired);

  await page.goto('/');
  await expect(page).toHaveURL(/\/login$/);
  const token = await page.evaluate(() => localStorage.getItem('token'));
  expect(token).toBeNull();
});

