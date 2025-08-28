import { test, expect } from '@playwright/test';

test('Guest → Lobby → Game basic flow', async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('button', { name: /continue as guest/i }).click();

  // Lobby
  await expect(page).toHaveURL(/\/lobby$/);
  await page.getByPlaceholder(/player 1 name/i).fill('P1');
  await page.getByPlaceholder(/player 2 name/i).fill('P2');
  await page.getByRole('button', { name: /start game/i }).click();

  // Game - privacy screen shows first
  await expect(page.getByRole('dialog', { name: /pass device/i })).toBeVisible();
  await page.getByRole('button', { name: /i’m p1 — start my turn/i }).click();

  // Deck button should be enabled and show remaining count
  const deckBtn = page.getByRole('button', { name: /deck \(\d+ cards? remaining\)/i });
  await expect(deckBtn).toBeEnabled();

  // Draw once and handle whichever modal appears
  await deckBtn.click();

  const drawnClose = page.getByRole('button', { name: /^close$/i });
  const fatalContinue = page.getByRole('button', { name: /continue/i });
  if (await drawnClose.isVisible().catch(() => false)) {
    await drawnClose.click();
  } else if (await fatalContinue.isVisible().catch(() => false)) {
    await fatalContinue.click();
  }

  // Game log should be visible
  await expect(page.getByText(/game log/i)).toBeVisible();
});

