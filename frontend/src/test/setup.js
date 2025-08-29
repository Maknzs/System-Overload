// Use Vitest-compatible exports from Testing Library
import '@testing-library/jest-dom/vitest';
import { afterEach, expect } from 'vitest';
import { cleanup } from '@testing-library/react';
import { toHaveNoViolations } from 'jest-axe';

// Ensure a clean DOM between tests to avoid duplicates
afterEach(() => {
  cleanup();
});

expect.extend(toHaveNoViolations);
