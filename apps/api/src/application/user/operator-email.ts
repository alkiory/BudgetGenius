import { normalizeEmail } from '@domain/user/user.entity';

/**
 * The one address allowed to hold the operator role.
 *
 * Shared by the boot seeder, the sign-in promotion and the backoffice guard so
 * the three cannot drift. Development keeps the local fallback; any other
 * environment needs `SUPERADMIN_EMAIL`, and an empty result means there is no
 * operator at all — the guard then denies the backoffice rather than trusting a
 * leftover row.
 */
export function resolveOperatorEmail(env = process.env): string {
  const configured = (env.SUPERADMIN_EMAIL ?? '').trim();
  if (configured) return normalizeEmail(configured);
  return env.NODE_ENV === 'development' ? 'superadmin@admin.com' : '';
}
