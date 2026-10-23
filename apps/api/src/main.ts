import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { LoggingService } from '@infrastructure/log/logger.service';
import cookieParser from 'cookie-parser';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { buildAllowedOrigins, buildCorsOptions } from './cors';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  const isProduction = process.env.NODE_ENV === 'production';

  // Enable middleware to read cookies
  app.use(cookieParser());

  // ── CORS ───────────────────────────────────────────────────────────────
  // Origin list + options live in `./cors` (shared with the preflight
  // specs). FRONTEND_URL may be a single URL or a comma-separated list
  // of origins; whatever the operator sets is merged with the
  // environment defaults (production defaults to the Firebase Hosting
  // domains + the Capacitor WebView origins, and every environment also
  // gets the localhost:5173 Vite dev-server origin).
  const allowedOrigins = buildAllowedOrigins(
    isProduction,
    process.env.FRONTEND_URL,
  );

  // Requests without an `Origin` header (curl, server-to-server) are
  // allowed. Browser requests need an exact match against the allow-list
  // after normalization. OPTIONS preflights are answered by the cors
  // middleware with `optionsSuccessStatus: 204` + Allow-Origin headers.
  app.enableCors(buildCorsOptions(allowedOrigins));

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
    `🔐 CORS allowed origins (${allowedOrigins.length}): ${allowedOrigins.join(
      ', ',
    )}`,
  );
}

bootstrap();
