import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { accessLogMiddleware } from '@infrastructure/log/access-log.middleware';
import { LoggingService } from '@infrastructure/log/logger.service';
import cookieParser from 'cookie-parser';
import { json, urlencoded } from 'express';
import helmet from 'helmet';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { buildAllowedOrigins, buildCorsOptions } from './cors';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  // Body parsing is registered explicitly below: the media upload carries a
  // base64 image and needs a larger limit than every other JSON route.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
  });

  const isProduction = process.env.NODE_ENV === 'production';

  // ── Access log ─────────────────────────────────────────────────────────
  // First middleware on the Express instance: a request that never reaches
  // this line was stopped in front of the API (tunnel, nginx, the browser),
  // which is what separates a backend stall from a proxy one.
  app.use(accessLogMiddleware);

  // ── CORS ───────────────────────────────────────────────────────────────
  // Register CORS BEFORE all body parsers so parser rejections (e.g. 413
  // Payload Too Large) still carry Access-Control-Allow-Origin headers and
  // browsers see HTTP 413 instead of an opaque network error.
  const allowedOrigins = buildAllowedOrigins(
    isProduction,
    process.env.FRONTEND_URL,
  );
  app.enableCors(buildCorsOptions(allowedOrigins));

  // Enable middleware to read cookies
  app.use(cookieParser());

  // Backoffice image uploads are JSON data URLs (5 MiB file ≈ 6.7 MB base64),
  // and bulk spreadsheet imports can carry up to 1,000 rows. Everything else
  // keeps Express's small default so oversized payloads cannot exhaust memory.
  app.use('/api/media', json({ limit: '8mb' }));
  app.use('/api/transactions/import', json({ limit: '2mb' }));
  app.use(json({ limit: '100kb' }));
  app.use(urlencoded({ extended: true, limit: '100kb' }));

  // ── Security headers (QA-0.4) ──────────────────────────────────────────
  // The API served no helmet headers at all: no CSP, no nosniff, no
  // frame-ancestors. The CSP below is written for a JSON API that also
  // serves the built SPA from `webClient/dist`:
  //   - `script-src 'self'` (no inline/eval). The two built-in pages that
  //     rely on inline JS — Swagger UI (`/docs`) and the Google-OAuth
  //     custom-scheme shim (`/api/auth/google-callback`, which does
  //     `window.location.replace('bgg://...')`) — are exempted from CSP
  //     below; blocking that shim would break Google login on the APK.
  //   - `style-src` keeps 'unsafe-inline' because the SPA and Swagger both
  //     inject inline style attributes; stylesheet injection is not the
  //     script-execution risk CSP is defending here.
  //   - `connect-src` includes the CORS allow-list so a same-origin copy
  //     of the SPA served by this API can still reach the API origin.
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          baseUri: ["'self'"],
          fontSrc: ["'self'", 'data:'],
          formAction: ["'self'"],
          frameAncestors: ["'none'"],
          imgSrc: ["'self'", 'data:', 'blob:'],
          objectSrc: ["'none'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          connectSrc: ["'self'", ...allowedOrigins],
          ...(isProduction ? {} : { upgradeInsecureRequests: null }),
        },
      },
      // Firebase Hosting / the APK fetch fonts and images cross-origin;
      // `same-origin` (the helmet default) would block those no-cors reads.
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  // Swagger UI and the Google-OAuth custom-scheme shim ship inline
  // <script> blocks, so they need the CSP off. Helmet already set the
  // header on the response by the time this runs; dropping it for those
  // two paths is cheaper than a second helmet instance per request.
  app.use(['/docs', '/api/auth/google-callback'], (_req, res, next) => {
    res.removeHeader('Content-Security-Policy');
    next();
  });

  // Global settings
  app.setGlobalPrefix('/api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.set('trust proxy', 'loopback');

  // ── Swagger (development only) ─────────────────────────────────────────
  // The docs describe every endpoint, payload and role. Serving them from
  // the public production API handed an unauthenticated map of the surface
  // to anyone who guessed `/api/docs`. Production now returns 404 there;
  // local development keeps the interactive docs.
  if (!isProduction) {
    const config = new DocumentBuilder()
      .setTitle('Budget Genius API')
      .setDescription('Documentación de la API de Budget Genius')
      .setVersion('1.0')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('docs', app, document);
  }

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
    `🔐 CORS allowed origins (${allowedOrigins.length}): ${allowedOrigins.join(
      ', ',
    )}`,
  );
}

bootstrap();
