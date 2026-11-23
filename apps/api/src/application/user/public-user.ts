/**
 * @module public-user
 *
 * Allow-list projection of the `User` entity for HTTP responses.
 *
 * `users` carries two secrets that must never leave the server:
 *
 *   - `password`     — the bcrypt hash. Offline cracking material.
 *   - `refreshToken` — a hashed long-lived credential.
 *
 * Two surfaces used to return the raw entity: every `/auth/*` success
 * response (`login`, `signup`, `firebase-login`) and `GET /user/profile`
 * (which `useRestoreSession` consumes on every app boot). An allow-list
 * — instead of a `delete user.password` deny-list — means a future
 * sensitive column is private by default.
 */

import { User } from '@domain/user/user.entity';

export interface PublicUser {
  id: number;
  name: string;
  surname?: string;
  email: string;
  authProvider: 'email' | 'google';
  role: string;
  isPremium: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Maps a `User` (or any partial of it, e.g. an entity that has not been
 * rehydrated after `save()`) to the wire shape. Returns `null` for a
 * missing user so callers can decide between 404 and an empty payload.
 */
export const toPublicUser = (
  user: Partial<User> | null | undefined,
): PublicUser | null => {
  if (!user) {
    return null;
  }

  return {
    id: user.id,
    name: user.name,
    surname: user.surname,
    email: user.email,
    authProvider: user.authProvider,
    role: user.role,
    isPremium: user.isPremium ?? true,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
};
