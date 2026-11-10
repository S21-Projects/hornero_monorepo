import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import { configureApp, SWAGGER_PATH } from './app.setup.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  configureApp(app);

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
  SwaggerModule.setup(SWAGGER_PATH, app, document);

  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();
