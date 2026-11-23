/**
 * Email casing must never matter — audit S6 / T0.8 follow-up.
 *
 * The UNIQUE index on `LOWER(email)` (migration 1800000000009) rejects a second
 * account that differs only in casing. That is only coherent if lookups and
 * writes agree on the same canonical form; otherwise signup blocks
 * `Foo@x.com` while login with that casing cannot find `foo@x.com`.
 */
import { UserRepositoryImpl } from '@adapters/user/persistence/user.repository';

describe('UserRepositoryImpl — email canonicalisation', () => {
  let db: { findOne: jest.Mock; save: jest.Mock };
  let repository: UserRepositoryImpl;

  beforeEach(() => {
    db = {
      findOne: jest.fn().mockResolvedValue(null),
      save: jest.fn((user) => Promise.resolve(user)),
    };
    repository = new UserRepositoryImpl(db as any, {
      error: jest.fn(),
      log: jest.fn(),
      warn: jest.fn(),
    } as any);
  });

  it('looks up the canonical form, so any casing finds the account', async () => {
    db.findOne.mockResolvedValue({ id: 1, email: 'foo@bar.com' });

    const found = await repository.findByEmail('  FOO@Bar.COM ');

    expect(db.findOne).toHaveBeenCalledWith({
      where: { email: 'foo@bar.com' },
    });
    expect(found).toEqual({ id: 1, email: 'foo@bar.com' });
  });

  it('stores the canonical form on signup', async () => {
    await repository.createUser({
      name: 'Case',
      surname: 'Tester',
      email: 'Foo@Bar.COM',
      password: 'secret',
      role: 'user',
      authProvider: 'email',
    } as any);

    expect(db.save).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'foo@bar.com' }),
    );
  });

  it('normalises on every save path (profile update, OAuth, seed)', async () => {
    await repository.save({ id: 1, email: 'MiXeD@Case.IO' } as any);

    expect(db.save).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'mixed@case.io' }),
    );
  });
});
