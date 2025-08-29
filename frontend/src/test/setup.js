// Use Vitest-compatible exports from Testing Library
import '@testing-library/jest-dom/vitest';
import { afterEach, expect, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { toHaveNoViolations } from 'jest-axe';

// Ensure a clean DOM between tests to avoid duplicates
afterEach(() => {
  cleanup();
});

expect.extend(toHaveNoViolations);

// Make user-event work seamlessly with fake timers used in some tests
// by providing an auto-advancing timer integration.
vi.mock('@testing-library/user-event', async () => {
  const actual = await vi.importActual('@testing-library/user-event');
  // userEvent v14 exposes setup() to integrate fake timers
  const setup = actual.default?.setup || actual.setup;
  if (setup) {
    const user = setup({
      // Advance fake timers if they are enabled; no-op otherwise
      advanceTimers: (ms) => {
        try { vi.advanceTimersByTime(ms ?? 0); } catch (_) {}
      },
      delay: null,
    });
    return { ...actual, default: user };
  }
  return actual;
});
