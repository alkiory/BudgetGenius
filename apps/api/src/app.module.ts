import * as admin from 'firebase-admin';
import { ServiceAccount } from 'firebase-admin';
import { MiddlewareConsumer, Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { UserModule } from '@infrastructure/user/user.module';
import { UserController } from '@adapters/user/http/user.controller';
import { UserService } from '@application/user/user.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DatabaseModule } from '@infrastructure/database.module';
import { UserSeederService } from '@application/user/user-seeder.service';
import { AuthModule } from '@infrastructure/auth/module/auth.module';
import { seconds, ThrottlerModule } from '@nestjs/throttler';
import { ThrottlerBehindProxyGuard } from '@infrastructure/config/guards/throttler-behind-proxy.guard';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { LoggingService } from '@infrastructure/log/logger.service';
import { AiModule } from './infrastructure/ai/module/ai.module';
import { CatalogModule } from '@infrastructure/catalog/catalog.module';
import { CookieService } from '@infrastructure/config/cookie.service';
import { RedisService } from '@infrastructure/config/redis.service';
import { DashboardModule } from '@infrastructure/dashboard/dashboard.module';
import { CoreModule } from '@infrastructure/core/core.module';
import { UserSettingsService } from '@application/user/user-settings.service';
import { UserSettingsModule } from '@infrastructure/user/user-settings.module';
import { FirebaseAuthMiddleware } from '@infrastructure/auth/firebase-auth.strategy';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TestController } from '@adapters/app.controller';
import { SuperAdminModule } from '@infrastructure/superadmin/superadmin.module';
import { SyncModule } from '@infrastructure/sync/sync.module';
import { NotificationsModule } from '@infrastructure/notifications/notifications.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      ignoreEnvFile: process.env.NODE_ENV === 'production',
      envFilePath:
        process.env.NODE_ENV === 'development' ? '.env.development' : '.env',
      validate: (config) => {
        if (!config.NODE_ENV) {
          throw new Error('NODE_ENV is required');
        }
        if (!config.JWT_SECRET) {
          throw new Error(
            'JWT_SECRET is required, please add it to the .env(development/production) file',
          );
        }
        return config;
      },
    }),
    ThrottlerModule.forRoot({
      throttlers: [
        {
          limit: 4, // 4 requests per 10 seconds
          ttl: seconds(10),
        },
      ],
      errorMessage:
        '😡 Wow! You are making too many requests. Please try again later.',
      storage: new ThrottlerStorageRedisService({
        // PRIORIDAD:
        // 1. Host inyectado por Docker ('redis')
        // 2. Variable de entorno
        // 3. Fallback a localhost para desarrollo local fuera de Docker
        host: process.env.REDIS_HOST || 'redis',
        port: Number(process.env.REDIS_PORT) || 6379,

        // IMPORTANTE: Elimina o comenta por completo la propiedad 'tls'
        // El Redis de Docker no usa TLS. Si esta propiedad existe, ioredis fallará.
        // tls: undefined,

        // Elimina también la password para el entorno Docker por defecto
        password: process.env.REDIS_PASSWORD || undefined,

        maxRetriesPerRequest: 5,
        connectTimeout: 10000,
      }),
      getTracker: (req: Record<string, any>) => {
        return req.headers['x-device-id'] || req.socket.remoteAddress;
      },
    }),
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '../../', 'webClient/dist'),
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DB_HOST') || 'localhost',
        port: configService.get<number>('DB_PORT') || 5432,
        username: configService.get<string>('DB_USER'),
        password:
          configService.get<string>('DB_PASS') ||
          configService.get<string>('DB_PASSWORD'),
        database: configService.get<string>('DB_NAME'),
        schema: 'bg_public',
        // FORZADO: En Docker, conectando a un contenedor local, SSL debe estar desactivado.
        // Solo se activaría si usaras una DB externa como AWS RDS.
        ssl: false,
        extra: {
          ssl: false, // Algunos drivers leen esto de la propiedad 'extra'
        },
        // En producción (Docker), buscamos los archivos compilados .js
        // En local (ts-node), buscamos los .ts
        entities: [__dirname + '/../**/*.entity.{js,ts}'],
        migrations: [__dirname + '/../migrations/*.{js,ts}'],
        // -------------------------------------------------------
        autoLoadEntities: true,
        synchronize: false,
        logging: configService.get<string>('NODE_ENV') === 'development',
      }),
    }),
    AuthModule,
    DatabaseModule,
    UserModule,
    UserSettingsModule,
    AiModule,
    DashboardModule,
    CoreModule,
    SuperAdminModule,
    SyncModule,
    NotificationsModule,
    CatalogModule,
  ],
  controllers: [AppController, UserController, TestController],
  providers: [
    AppService,
    UserService,
    UserSeederService,
    UserSettingsService,
    LoggingService,
    RedisService,
    {
      provide: 'APP_GUARD',
      useClass: ThrottlerBehindProxyGuard,
    },
    CookieService,
    {
      provide: 'FIREBASE_ADMIN',
      useFactory: (configService: ConfigService) => {
        const serviceAccount: ServiceAccount = {
          projectId: configService.get<string>('FIREBASE_PROJECT_ID'),
          clientEmail: configService.get<string>('FIREBASE_CLIENT_EMAIL'),
          privateKey: configService
            .get<string>('FIREBASE_PRIVATE_KEY')
            .replace(/\\n/g, '\n'),
        };
        return admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
        });
      },
      inject: [ConfigService],
    },
  ],
  exports: [LoggingService],
})
export class AppModule {
  constructor(private configService: ConfigService) {}

  configure(consumer: MiddlewareConsumer) {
    // Ruta específica para Firebase (Google Login)
    consumer.apply(FirebaseAuthMiddleware).forRoutes('auth/firebase-login');
  }

  static cookieOptions(configService: ConfigService) {
    const isProduction = configService.get<string>('NODE_ENV') === 'production';
    return {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? ('none' as const) : ('lax' as const),
      // Sessions last 7 days, matching the refresh token's JWT and the
      // 7-day Redis entry. The access token itself is signed for 7d too
      // (auth.service.ts), so a returning user is not logged out after an
      // hour of inactivity.
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 días
      domain: configService.get<string>('COOKIE_DOMAIN'),
      path: '/',
    };
  }
}
