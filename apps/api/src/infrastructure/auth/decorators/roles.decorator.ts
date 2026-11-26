import { SetMetadata } from '@nestjs/common';
import { UserRole } from '@domain/user/user.entity';

/**
 * Metadata key read by `RolesGuard` (it looks up the literal `'roles'`).
 * Kept as a constant so the string is declared once.
 */
export const ROLES_KEY = 'roles';

/**
 * Declares which roles may reach a handler/controller. Always paired with
 * `JwtAuthGuard` first: `RolesGuard` reads `req.user.role`, which only exists
 * once the JWT strategy has run.
 *
 *   @UseGuards(JwtAuthGuard, RolesGuard)
 *   @Roles(UserRole.SUPERADMIN)
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
