import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import { AxiosExceptionFilter } from './common/axios-exception.filter.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(cookieParser());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new AxiosExceptionFilter());
  // CORS_ORIGINS (if set) is the explicit allowlist (prod). Otherwise merge the
  // local dev origins with FRONTEND_URL so setting FRONTEND_URL never shadows the
  // SPA (:5173) / Astro (:4321) origins.
  const defaultOrigins = [
    'http://localhost:3000',
    'http://localhost:5173',
    'http://localhost:4321',
  ];
  const allowedOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean)
    : Array.from(
        new Set([
          ...defaultOrigins,
          ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL.trim()] : []),
        ]),
      );
  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (server-to-server, curl, Swagger).
      // Disallowed origins are rejected cleanly (no header) rather than throwing a 500.
      callback(null, !origin || allowedOrigins.includes(origin));
    },
    credentials: true,
  });

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Hornero BFF API')
    .setDescription(
      'Backend-for-Frontend API. Protected routes require a valid JWT cookie (access_token). ' +
        'The Bearer auth scheme below is for direct token testing; in normal use the browser sends the cookie automatically.',
    )
    .setVersion('1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'access-token',
    )
    .addCookieAuth('access_token')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();
