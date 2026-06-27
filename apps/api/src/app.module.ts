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
import { AiService } from '@application/ai/ai.service';
import { CookieService } from '@infrastructure/config/cookie.service';
import { RedisService } from '@infrastructure/config/redis.service';
import { DashboardModule } from '@infrastructure/dashboard/dashboard.module';
import { CoreModule } from '@infrastructure/core/core.module';
import { CurrencyModule } from '@infrastructure/currency/currency.module';
import { UserSettingsService } from '@application/user/user-settings.service';
import { UserSettingsModule } from '@infrastructure/user/user-settings.module';
import { FirebaseAuthMiddleware } from '@infrastructure/auth/firebase-auth.strategy';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TestController } from '@adapters/app.controller';

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
    CurrencyModule,
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
    AiService,
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
      // v1.3.0 — bumped from 15 to 30 minutes. See
      // rpi/mobile-cookies-persistence/research.md §"5. ⚠ The 15-min
      // default cookieOptions.maxAge is short for the WebView's
      // refresh-window" + plan.md T1.5. Keeps refresh cadence inside
      // the 4-rps ThrottlerModule window even on slower CGNAT
      // connections. JWT `expiresIn: '1h'` (auth.service.ts:114-120)
      // remains the authoritative timeout.
      maxAge: 30 * 60 * 1000, // 30 minutos
      domain: configService.get<string>('COOKIE_DOMAIN'),
      path: '/',
    };
  }
}
