import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { AuthModule } from '../auth/auth.module.js';
import { OrganizacionesModule } from '../organizaciones/organizaciones.module.js';
import { ThrottlerModule } from '@nestjs/throttler';
import { ReclamosModule } from '../reclamos/reclamos.module.js';
import { AUTH_THROTTLER_OPTIONS } from '../auth/auth-throttler.config.js';
import { UploadController } from './upload.controller.js';
import { UploadService } from './upload.service.js';
import { uploadMulterOptions } from './upload-limits.js';

@Module({
  imports: [
    ConfigModule,
    MulterModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: uploadMulterOptions,
    }),
    OrganizacionesModule,
    AuthModule,
    ReclamosModule,
    // Only guards the routes that opt in with ClientIpThrottlerGuard (claim evidence upload).
    ThrottlerModule.forRoot(AUTH_THROTTLER_OPTIONS),
  ],
  providers: [UploadService],
  controllers: [UploadController],
})
export class UploadModule {}
