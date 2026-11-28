import { User, UserRole, normalizeEmail } from '@domain/user/user.entity';
import { resolveOperatorEmail } from '@application/user/operator-email';
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Injectable()
export class RolesGuard implements CanActivate {
  private readonly logger = new Logger(RolesGuard.name);

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

    if (!user) {
      throw new ForbiddenException('Insufficient permissions');
    }

    // The operator role is decided from the row, never from the token.
    //
    // `JwtStrategy` returns the role the token was signed with, and an access
    // token lives for seven days. An account promoted during that window (the
    // boot seeder, the SQL promotion in the README, `ensureOperatorRole` on a
    // social sign-in) kept being refused here — the menu appeared because the
    // profile comes from the database, and every backoffice call answered 403
    // until the token expired. The row is the authority; this guard already
    // reads it, so it can decide from it.
    if (requiredRoles.includes(UserRole.SUPERADMIN)) {
      return this.assertOperator(user);
    }

    if (!requiredRoles.includes(user.role)) {
      throw new ForbiddenException('Insufficient permissions');
    }

    return true;
  }

  /**
   * Two conditions, not one. The role alone is not enough: if a handover
   * cleanup failed, the former operator's row may still say `superadmin`, and
   * only the address configured in `SUPERADMIN_EMAIL` is the operator. An
   * unconfigured address denies everyone rather than trusting a leftover row.
   */
  private async assertOperator(user: {
    userId?: string | number;
  }): Promise<true> {
    const id = Number(user?.userId);
    const current = Number.isInteger(id)
      ? await this.users.findOne({
          where: { id },
          select: ['id', 'role', 'email'],
        })
      : null;

    const operatorEmail = resolveOperatorEmail();
    const holdsRole = current?.role === UserRole.SUPERADMIN;
    const isOperatorAddress =
      Boolean(current) &&
      Boolean(operatorEmail) &&
      normalizeEmail(current!.email) === operatorEmail;

    if (holdsRole && isOperatorAddress) {
      return true;
    }

    // One line per denied backoffice request, with no address in it: the
    // difference between "the row is not promoted" and "SUPERADMIN_EMAIL points
    // elsewhere" is invisible from the 403 alone.
    this.logger.warn(
      `🛡️ Backoffice denied for user id=${user?.userId ?? 'unknown'}: ` +
        `role=${current?.role ?? 'missing'} ` +
        `operatorConfigured=${Boolean(operatorEmail)} ` +
        `addressMatches=${isOperatorAddress} — check users.role and ` +
        'SUPERADMIN_EMAIL for this account',
    );

    throw new ForbiddenException('Insufficient permissions');
  }
}
