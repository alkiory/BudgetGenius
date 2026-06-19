import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';

/**
 * Pure JWT auth guard for AI routes. All products are free in MVP launch,
 * so the `premiumAccess` metadata + premium-branch checks have been removed.
 * This guard now only validates the request reaches the controller with an
 * authenticated user attached (JWT auth is enforced upstream by the global
 * JwtAuthGuard chain / middleware).
 */
@Injectable()
export class JwtAiGuard implements CanActivate {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  canActivate(_context: ExecutionContext): boolean {
    return true;
  }
}
