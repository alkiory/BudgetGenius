import * as fs from 'fs';
import * as path from 'path';
import { JwtAiGuard } from '@infrastructure/ai/guard/jwt-ai.guard';
import { AiController } from '@adapters/ai/http/ai.controller';

/**
 * MVP launch contract: AI endpoints produce the same response for every user
 * regardless of any premium flag. Two layers of coverage:
 *
 *  1. JwtAiGuard.canActivate() returns true for any request — the dead
 *     `premiumAccess` reflector lookup and `!user.isPremium` branch have been
 *     removed.
 *  2. AiController does NOT import or apply PremiumGuard in its
 *     `@UseGuards(...)` decorator chain (compile-time introspectable via
 *     source read + the controller's constructor argument count).
 */
describe('AI surface — MVP isPremium gate removed (T3.27)', () => {
  describe('JwtAiGuard', () => {
    const makeCtx = (user: unknown) =>
      ({
        switchToHttp: () => ({ getRequest: () => ({ user }) }),
        getHandler: () => undefined,
        getClass: () => undefined,
        getArgs: () => [],
        getArgByIndex: () => undefined,
        switchToRpc: () => ({}),
        switchToWs: () => ({}),
        getType: () => 'http',
      }) as any;

    it('returns true for a non-premium user', () => {
      const guard = new JwtAiGuard();
      const ctx = makeCtx({ id: 1, isPremium: false });
      expect(guard.canActivate(ctx)).toBe(true);
    });

    it('returns true when user has no isPremium field at all', () => {
      const guard = new JwtAiGuard();
      const ctx = makeCtx({ id: 1 });
      expect(guard.canActivate(ctx)).toBe(true);
    });

    it('does not declare constructor parameters (simplified guard)', () => {
      const ctorParams =
        Reflect.getMetadata('design:paramtypes', JwtAiGuard) ?? [];
      expect(ctorParams.length).toBe(0);
    });
  });

  describe('AiController', () => {
    it('does not declare PremiumGuard or premiumAccess in its source', () => {
      const controllerPath = path.join(
        __dirname,
        '..',
        'src',
        'adapters',
        'ai',
        'http',
        'ai.controller.ts',
      );
      const src = fs.readFileSync(controllerPath, 'utf8');
      expect(src).not.toMatch(/PremiumGuard/);
      expect(src).not.toMatch(/premiumAccess/);
      expect(src).toMatch(/JwtAiGuard/);
    });

    it('controller constructor takes only the AI service (no Reflector)', () => {
      const ctorParams =
        Reflect.getMetadata('design:paramtypes', AiController) ?? [];
      expect(Array.isArray(ctorParams)).toBe(true);
      expect(ctorParams.length).toBe(1);
    });
  });
});
