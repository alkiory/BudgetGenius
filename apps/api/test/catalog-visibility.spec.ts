/**
 * "Create a module → it shows up in the app" (end to end).
 *
 * The backoffice and the catalogue are two different surfaces reading the same
 * table, so the only honest regression test is through HTTP: the superadmin
 * registers the entry, a regular account sees it, and disabling it removes it
 * from that account's catalogue.
 *
 * The operator account is seeded from `SUPERADMIN_EMAIL` on boot (the seeder
 * runs before the development-only gate), so the suite sets its own throwaway
 * address instead of depending on a real one.
 */

import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import request = require('supertest');
import { UserSeederService } from '@application/user/user-seeder.service';

const SUPER_EMAIL = 'catalog-e2e-superadmin@example.com';
const SUPER_PASSWORD = 'CatalogE2E_v1!';
const USER_EMAIL = 'catalog-e2e-user@example.com';
const USER_PASSWORD = 'CatalogE2E_v1!';
const MODULE_KEY = 'audit-e2e-module';

// Read by the seeder when AppModule boots, before the development-only gate.
// Restored below so the throwaway operator cannot leak into another spec that
// boots AppModule in the same Jest process.
const PREVIOUS_SUPERADMIN = {
  email: process.env.SUPERADMIN_EMAIL,
  password: process.env.SUPERADMIN_PASSWORD,
};
process.env.SUPERADMIN_EMAIL = SUPER_EMAIL;
process.env.SUPERADMIN_PASSWORD = SUPER_PASSWORD;

const restoreSuperadminEnv = () => {
  if (PREVIOUS_SUPERADMIN.email === undefined) {
    delete process.env.SUPERADMIN_EMAIL;
  } else {
    process.env.SUPERADMIN_EMAIL = PREVIOUS_SUPERADMIN.email;
  }
  if (PREVIOUS_SUPERADMIN.password === undefined) {
    delete process.env.SUPERADMIN_PASSWORD;
  } else {
    process.env.SUPERADMIN_PASSWORD = PREVIOUS_SUPERADMIN.password;
  }
};

describe('Catalogue visibility (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let superToken: string;
  let userToken: string;
  let moduleId: number;

  // Every request counts against the 4-per-10 s per-device throttle; each one
  // presents itself as a different device so the suite tests the catalogue,
  // not the rate limiter.
  let deviceSeq = 0;
  const device = () => ({
    'X-Device-Id': `catalog-e2e-${Date.now()}-${++deviceSeq}`,
  });

  const cleanup = async () => {
    try {
      await dataSource.query(
        `DELETE FROM "bg_public"."app_modules" WHERE "key" = $1`,
        [MODULE_KEY],
      );
      await dataSource.query(
        `DELETE FROM "bg_public"."user_settings" WHERE "userId" IN (
           SELECT "id" FROM "bg_public"."users" WHERE "email" = ANY($1::text[])
         )`,
        [[SUPER_EMAIL, USER_EMAIL]],
      );
      await dataSource.query(
        `DELETE FROM "bg_public"."users" WHERE "email" = ANY($1::text[])`,
        [[SUPER_EMAIL, USER_EMAIL]],
      );
    } catch {
      /* best-effort cleanup: a missing table must not fail the suite */
    }
  };

  beforeAll(async () => {
    // Loaded with `require` on purpose: the module must be imported AFTER the
    // env above is in place, so the seeder creates this suite's operator
    // instead of promoting whatever `SUPERADMIN_EMAIL` the environment has.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { AppModule } = require('../src/app.module');
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider('FIREBASE_ADMIN')
      .useValue({})
      .compile();

    app = moduleFixture.createNestApplication();
    dataSource = app.get(DataSource);
    await app.init();

    // Boot seeds the operator before this cleanup removes stale rows from a
    // previous run, so seed once more — through the real seeder, not by
    // inserting a user behind its back.
    await cleanup();
    await app.get(UserSeederService).createDefaultUsers();
  });

  afterAll(async () => {
    await cleanup();
    await app.close();
    restoreSuperadminEnv();
  });

  it('registers a module from the backoffice', async () => {
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .set(device())
      .send({ email: SUPER_EMAIL, password: SUPER_PASSWORD })
      .expect(201);

    superToken = login.body.accessToken;
    expect(typeof superToken).toBe('string');

    const created = await request(app.getHttpServer())
      .post('/superadmin/modules')
      .set('Authorization', `Bearer ${superToken}`)
      .set(device())
      .send({
        key: MODULE_KEY,
        name: 'Auditoría E2E',
        kind: 'module',
        status: 'active',
      })
      .expect(201);

    moduleId = created.body.id;
    expect(typeof moduleId).toBe('number');
  });

  it('shows the active module to a regular account', async () => {
    const signup = await request(app.getHttpServer())
      .post('/auth/signup')
      .set(device())
      .send({
        name: 'Catalog',
        surname: 'Reader',
        email: USER_EMAIL,
        password: USER_PASSWORD,
        authProvider: 'email',
        role: 'user',
      })
      .expect(201);
    userToken = signup.body.accessToken;

    const catalogue = await request(app.getHttpServer())
      .get('/catalog/entries')
      .set('Authorization', `Bearer ${userToken}`)
      .set(device())
      .expect(200);

    const keys = (catalogue.body as Array<{ key: string }>).map(
      (entry) => entry.key,
    );
    expect(keys).toContain(MODULE_KEY);
  });

  it('hides it again when the backoffice disables it', async () => {
    await request(app.getHttpServer())
      .put(`/superadmin/modules/${moduleId}`)
      .set('Authorization', `Bearer ${superToken}`)
      .set(device())
      .send({ status: 'disabled' })
      .expect(200);

    const catalogue = await request(app.getHttpServer())
      .get('/catalog/entries')
      .set('Authorization', `Bearer ${userToken}`)
      .set(device())
      .expect(200);

    const keys = (catalogue.body as Array<{ key: string }>).map(
      (entry) => entry.key,
    );
    expect(keys).not.toContain(MODULE_KEY);
  });
});
