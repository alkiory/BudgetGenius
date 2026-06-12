import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class JwtAiGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const premiumAccess =
      this.reflector.get<boolean>('premiumAccess', context.getHandler()) ||
      this.reflector.get<boolean>('premiumAccess', context.getClass());

    if (!premiumAccess) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();

    if (!user.isPremium) {
      throw new UnauthorizedException('😲 You found a premium feature!');
    }

    return true;
  }
}
