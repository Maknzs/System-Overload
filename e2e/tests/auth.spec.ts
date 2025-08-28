import { test, expect } from '@playwright/test';

function uniq() {
  return Math.floor(Math.random() * 1e9);
}

test('Register → Login → Menu updates → Logout', async ({ page }) => {
  const id = uniq();
  const email = `e2e${id}@example.com`;
  const username = `e2euser${id}`;
  const password = `Password${(id % 1000) + 1}!`;

  // Go to register
  await page.goto('/register');
  await page.getByPlaceholder('Email').fill(email);
  await page.getByPlaceholder('Username').fill(username);
  await page.getByPlaceholder('Password').fill(password);
  await page.getByRole('button', { name: /create account/i }).click();

  // Should navigate to login
  await expect(page).toHaveURL(/\/login$/);

  // Login
  await page.getByPlaceholder(/email or username/i).fill(email);
  await page.getByPlaceholder(/password/i).fill(password);
  await page.getByRole('button', { name: /login/i }).click();

  // Should land on menu
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText(/username:/i)).toContainText(username);
  await expect(page.getByText(/email:/i)).toContainText(email);

  // Change email
  await page.getByRole('button', { name: /change email/i }).click();
  await page.getByPlaceholder(/new email/i).fill(`new-${email}`);
  await page.getByPlaceholder(/current password/i).first().fill(password);
  await page.getByRole('button', { name: /^save$/i }).first().click();
  await expect(page.getByText(/changes saved/i)).toBeVisible();

  // Change username
  await page.getByRole('button', { name: /change username/i }).click();
  await page.getByPlaceholder(/new username/i).fill(`${username}-x`);
  await page.getByPlaceholder(/current password/i).nth(1).fill(password);
  await page.getByRole('button', { name: /^save$/i }).nth(1).click();
  await expect(page.getByText(/changes saved/i)).toBeVisible();

  // Change password
  await page.getByRole('button', { name: /change password/i }).click();
  await page.getByPlaceholder(/^current password$/i).fill(password);
  const newPassword = password + 'A';
  await page.getByPlaceholder(/^new password$/i).fill(newPassword);
  await page.getByPlaceholder(/confirm new password/i).fill(newPassword);
  await page.getByRole('button', { name: /^save$/i }).nth(2).click();
  await expect(page.getByText(/changes saved/i)).toBeVisible();

  // Logout
  await page.getByRole('button', { name: /logout/i }).click();
  await expect(page).toHaveURL(/\/login$/);

  // Login again with new password
  await page.getByPlaceholder(/email or username/i).fill(`new-${email}`);
  await page.getByPlaceholder(/password/i).fill(newPassword);
  await page.getByRole('button', { name: /login/i }).click();
  await expect(page).toHaveURL(/\/$/);
});

