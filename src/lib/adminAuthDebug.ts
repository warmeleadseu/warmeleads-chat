/**
 * Admin-auth debug: browserconsole + Vercel function logs.
 *
 * Aanzetten:
 * - Vercel: NEXT_PUBLIC_ADMIN_AUTH_DEBUG=1 (en opnieuw deployen) óf ADMIN_AUTH_DEBUG=1 voor alleen serverlogs.
 * - Zonder deploy: ga naar /admin?debugAuth=1 — zet sessionStorage en herlaadt daarna zonder query als je wilt.
 */

const TAG = '[WL AdminAuth]';

export function adminAuthDebugServerEnabled(): boolean {
  return (
    process.env.NEXT_PUBLIC_ADMIN_AUTH_DEBUG === '1' ||
    process.env.ADMIN_AUTH_DEBUG === '1'
  );
}

export function adminAuthDebugClientEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  if (
    process.env.NEXT_PUBLIC_ADMIN_AUTH_DEBUG === '1' ||
    process.env.ADMIN_AUTH_DEBUG === '1'
  ) {
    return true;
  }
  try {
    return sessionStorage.getItem('wl_admin_auth_debug') === '1';
  } catch {
    return false;
  }
}

export function adminAuthDebugServer(message: string, data?: Record<string, unknown>): void {
  if (!adminAuthDebugServerEnabled()) return;
  if (data && Object.keys(data).length > 0) {
    console.info(`${TAG} ${message}`, data);
  } else {
    console.info(`${TAG} ${message}`);
  }
}

export function adminAuthDebugClient(message: string, data?: Record<string, unknown>): void {
  if (!adminAuthDebugClientEnabled()) return;
  if (data && Object.keys(data).length > 0) {
    console.info(`${TAG} ${message}`, data);
  } else {
    console.info(`${TAG} ${message}`);
  }
}

/** Alleen voor logs; geen volledige e-mail. */
export function redactEmail(email: string): string {
  const e = email.trim().toLowerCase();
  const at = e.indexOf('@');
  if (at < 1) return '(ongeldig)';
  const local = e.slice(0, at);
  const domain = e.slice(at + 1);
  const show = Math.min(2, local.length);
  return `${local.slice(0, show)}…@${domain}`;
}
