/**
 * `clearPassword` promises to write SQL NULL, but the repository needs a cast
 * to say so (`password` is typed `string`, the column is nullable). A cast only
 * proves the code compiles: an empty string, a hash of "null" or a silently
 * dropped column would all leave the earlier registrant's credential usable.
 *
 * This spec runs the real statement against the suite's Postgres (the same
 * database the e2e specs use: CI provisions it, locally `.env.development`
 * points at the dev one) and reads the column back.
 */

import { DataSource } from 'typeorm';
import { AppDataSource } from '../src/data-source';
import { User } from '@domain/user/user.entity';
import { UserRepositoryImpl } from '@adapters/user/persistence/user.repository';

describe('UserRepositoryImpl.clearPassword (real SQL)', () => {
  let dataSource: DataSource;
  let repository: UserRepositoryImpl;
  let schema: string;
  let userId: number | undefined;

  const email = `clear-password-${Date.now()}@example.test`;

  beforeAll(async () => {
    dataSource = new DataSource({
      ...AppDataSource.options,
      // The app data source logs every query; keep the suite output readable.
      logging: false,
    });
    await dataSource.initialize();
    // `DataSourceOptions` is a union; only the Postgres member carries
    // `schema`, which `data-source.ts` pins to `bg_public`.
    schema = (dataSource.options as { schema?: string }).schema ?? 'public';
    repository = new UserRepositoryImpl(dataSource.getRepository(User), {
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as never);
  });

  afterAll(async () => {
    if (userId !== undefined) {
      await dataSource.query(
        `DELETE FROM "${schema}"."users" WHERE "id" = $1`,
        [userId],
      );
    }
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }
  });

  it('leaves the column NULL instead of an empty string or a hash', async () => {
    // Same write path as production (`createUser`): an entity instance, so the
    // `@BeforeInsert` hook hashes the password. A plain object literal skips
    // the listener's value when TypeORM builds the insert.
    const entity = new User();
    entity.name = 'Squatter';
    entity.surname = null;
    entity.email = email;
    entity.password = 'Squatter#123';
    entity.role = 'user';
    entity.authProvider = 'email';

    const inserted = await dataSource.getRepository(User).save(entity);
    userId = inserted.id;

    // Sanity check, read from the row: the fixture is a bcrypt hash before the
    // cleanup.
    const [before]: Array<{ password: string | null }> = await dataSource.query(
      `SELECT "password" FROM "${schema}"."users" WHERE "id" = $1`,
      [userId],
    );
    expect(before.password).toMatch(/^\$2[aby]\$/);

    await repository.clearPassword(userId);

    const rows: Array<{ password: string | null }> = await dataSource.query(
      `SELECT "password" FROM "${schema}"."users" WHERE "id" = $1`,
      [userId],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].password).toBeNull();

    // Only the credential is gone: the account row still exists, so this is
    // not a delete and the operator promotion keeps the same account.
    const stillThere = await dataSource
      .getRepository(User)
      .findOne({ where: { id: userId } });
    expect(stillThere).not.toBeNull();
  });
});
