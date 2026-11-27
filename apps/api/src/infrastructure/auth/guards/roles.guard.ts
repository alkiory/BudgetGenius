import { User, UserRole, normalizeEmail } from '@domain/user/user.entity';
import { resolveOperatorEmail } from '@application/user/operator-email';
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles =
      this.reflector.get<UserRole[]>('roles', context.getHandler()) ||
      this.reflector.get<UserRole[]>('roles', context.getClass());

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();

    if (!user || !requiredRoles.includes(user.role)) {
      throw new ForbiddenException('Insufficient permissions');
    }

    // The token carries the role it was signed with, and `JwtStrategy` does
    // not re-read it. The boot seeder demotes every superadmin except the
    // configured operator, so without this check a demoted account would keep
    // the whole backoffice until its 7-day JWT expired. Only `@Roles` in the
    // codebase is the operator role, and this module already registers `User`,
    // so the extra lookup stays on the low-traffic backoffice routes.
    if (requiredRoles.includes(UserRole.SUPERADMIN)) {
      const current = await this.users.findOne({
        where: { id: Number(user.userId) },
        select: ['id', 'role', 'email'],
      });

      // Two conditions, not one. The role alone is not enough: if a handover
      // cleanup failed, the former operator's row may still say `superadmin`,
      // and only the address configured in `SUPERADMIN_EMAIL` is the operator.
      const operatorEmail = resolveOperatorEmail();
      if (
        current?.role !== UserRole.SUPERADMIN ||
        !operatorEmail ||
        normalizeEmail(current.email) !== operatorEmail
      ) {
        throw new ForbiddenException('Insufficient permissions');
      }
    }

    return true;
  }
}
