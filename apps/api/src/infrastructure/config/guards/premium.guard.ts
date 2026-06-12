import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';

@Injectable()
export class PremiumGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (user && !user.isPremium) {
      return true;
    } else {
      throw new ForbiddenException(
        '👑 Access denied. Premium membership required.',
      );
    }
  }
}
