// Frontend config: derive app phase independent of build mode if desired.

// Preferred: VITE_APP_PHASE (development | staging | production)
const phaseVar = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_APP_PHASE) || '';
const modeVar = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.MODE) || '';

export const APP_PHASE = String(phaseVar || '').toLowerCase() || (modeVar === 'production' ? 'production' : 'development');
export const IS_DEV_PHASE = APP_PHASE === 'development' || (typeof import.meta !== 'undefined' && import.meta.env && !!import.meta.env.DEV);

// Allow a query/localStorage override so testers can flip dev features in a built app
export function isDevUiEnabled() {
  try {
    const usp = new URLSearchParams(window.location.search);
    const qp = usp.get('dev');
    if (qp === '1' || qp === '0') {
      localStorage.setItem('dev_ui', qp);
    }
    const stored = localStorage.getItem('dev_ui');
    if (stored === '1') return true;
  } catch {}
  return IS_DEV_PHASE;
}

export function getPublicBaseUrl() {
  try {
    const envUrl =
      typeof import.meta !== 'undefined' &&
      import.meta.env &&
      (import.meta.env.VITE_PUBLIC_BASE_URL || import.meta.env.BASE_URL);
    if (envUrl) {
      const trimmed = String(envUrl).trim();
      if (/^https?:\/\//i.test(trimmed)) {
        return trimmed.replace(/\/$/, '');
      }
    }
  } catch {}
  if (typeof window !== 'undefined' && window.location) {
    return window.location.origin;
  }
  return 'https://system-overload.com';
}
