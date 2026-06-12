import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { UserService } from '@application/user/user.service';

describe('UserController (e2e)', () => {
  let app: INestApplication;
  const userService = { createUser: jest.fn(), getUser: jest.fn() };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(UserService)
      .useValue(userService)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/user (POST) should create a user', async () => {
    const userDto = {
      name: 'Test User',
      email: 'test@email.com',
      password: 'test123',
    };
    userService.createUser.mockResolvedValue(userDto);

    return request(app.getHttpServer())
      .post('/api/user')
      .send(userDto)
      .expect(201)
      .expect(userDto);
  });

  it('/user/:id (GET) should return a user', async () => {
    const user = { id: 3, name: 'Admin user', email: 'admin@admin.com' };
    userService.getUser.mockResolvedValue(user);

    return request(app.getHttpServer())
      .get('/api/user/3')
      .expect(200)
      .expect(user);
  });

  afterAll(async () => {
    await app.close();
  });
});
