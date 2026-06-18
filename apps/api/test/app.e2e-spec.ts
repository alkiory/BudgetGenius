import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request = require('supertest');
import { AppModule } from '../src/app.module';

describe('User API (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/users (POST)', async () => {
    return request(app.getHttpServer())
      .post('/users')
      .send({ id: '3', name: 'Admin user', email: 'admin@admin.com' })
      .expect(201);
  });

  it('/users/:id (GET)', async () => {
    return request(app.getHttpServer()).get('/users/3').expect(200);
  });

  afterAll(async () => {
    await app.close();
  });
});
