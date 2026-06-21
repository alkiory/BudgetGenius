import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { LoggingService } from '@infrastructure/log/logger.service';
import cookieParser from 'cookie-parser';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

// CORS - Default origins served for each environment.
// They are merged with whatever is declared in the FRONTEND_URL env var
// so deployment-specific domains can be added without code changes.
const PRODUCTION_DEFAULT_ORIGINS = [
  'https://budgetgeniusia.web.app',
  'https://budgetgeniusia.firebaseapp.com',
];

const DEV_DEFAULT_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3001',
  'http://127.0.0.1:3001',
];

/**
 * Trims whitespace and trailing slashes so we can compare origins
 * exactly against the `Origin` header the browser sends.
 */
const normalizeOrigin = (raw: string): string =>
  (raw ?? '').trim().replace(/\/+$/, '');

/**
 * FRONTEND_URL may be a single URL or a comma-separated list.
 * Empty entries are dropped; duplicates are de-duplicated by the caller.
 */
const parseOriginList = (raw: string | undefined | null): string[] =>
  (raw ?? '')
    .split(',')
    .map(normalizeOrigin)
    .filter(Boolean);

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  const isProduction = process.env.NODE_ENV === 'production';

  // Enable middleware to read cookies
  app.use(cookieParser());

  // ── CORS ───────────────────────────────────────────────────────────────
  // FRONTEND_URL may be a single URL or a comma-separated list of origins.
  // Whatever the operator sets is merged with the environment defaults
  // (production defaults to the Firebase Hosting domains).
  const frontendOrigins = parseOriginList(process.env.FRONTEND_URL);

  const allowedOrigins = Array.from(
    new Set(
      isProduction
        ? [...PRODUCTION_DEFAULT_ORIGINS, ...frontendOrigins]
        : [...DEV_DEFAULT_ORIGINS, ...frontendOrigins],
    ),
  );

  // Requests without an `Origin` header (curl, server-to-server) are
  // allowed. Browser requests need an exact match against the allow-list
  // after normalization.
  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) {
        return callback(null, true);
      }
      const normalized = normalizeOrigin(origin);
      if (allowedOrigins.includes(normalized)) {
        return callback(null, true);
      }
      logger.warn(`🛑 CORS: blocking request from origin '${origin}'`);
      return callback(null, false);
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: true,
    optionsSuccessStatus: 204,
    exposedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  });

  // Global settings
  app.setGlobalPrefix('/api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.set('trust proxy', 'loopback');

  // Swagger setup
  const config = new DocumentBuilder()
    .setTitle('Budget Genius API')
    .setDescription('Documentación de la API de Budget Genius')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  // Start server
  await app.listen(process.env.PORT || 5000, '0.0.0.0');

  // Logging
  const loggerService = app.get(LoggingService);
  app.useLogger(loggerService);

  logger.log(
    `🚂 App is in ${isProduction ? 'production' : 'development'} mode`,
  );
  logger.log(`🚀 Application is running on: ${await app.getUrl()}`);
  logger.log(
    `🔐 CORS allowed origins (${allowedOrigins.length}): ${allowedOrigins.join(', ')}`,
  );
}

bootstrap();
