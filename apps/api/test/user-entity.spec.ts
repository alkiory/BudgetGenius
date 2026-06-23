import * as bcrypt from 'bcryptjs';
import { User } from '@domain/user/user.entity';

describe('User entity', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  // The hashPassword hook body, called by both @BeforeInsert and
  // @BeforeUpdate. Proving the hook mutates plaintext into a real bcrypt
  // hash is the single missing link between
  // `userService.updateUser` (which forwarder-tests in
  // `apps/api/test/user-service.spec.ts` now assert plaintext
  // passthrough) and the actual SQL UPDATE column value. Repository
  // unit tests cannot prove the hook fires because they mock the repo.
  it('should bcrypt-hash a plaintext password via hashPassword()', async () => {
    const user = new User();
    user.password = 'plaintext123';

    await user.hashPassword();

    expect(user.password).toBeDefined();
    expect(user.password).not.toBe('plaintext123');
    expect(user.password).toMatch(/^\$2[aby]\$\d{2}\$/);
    expect(await bcrypt.compare('plaintext123', user.password)).toBe(true);
  });

  // The hook's truthy-check (`if (this.password)`) treats falsy values
  // as "no password" and leaves them untouched. This is intentional
  // (so Social-account rows can have `password: null` without being
  // re-hashed into "$2a$…null…") but the user-service layer guards
  // against the empty-string case before reaching the hook.
  it('should leave a falsy password untouched', async () => {
    const socialUser = new User();
    socialUser.password = undefined as unknown as string;

    await socialUser.hashPassword();

    expect(socialUser.password).toBeUndefined();
  });
});
