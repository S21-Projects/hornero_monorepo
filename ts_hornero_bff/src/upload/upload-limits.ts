import type { ConfigService } from '@nestjs/config';
import type { MulterModuleOptions } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { imageMimeFilter } from './image-type.js';

/** 5 MB: the limit when `UPLOAD_MAX_MB` is not set. */
export const DEFAULT_MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

/**
 * Parses `UPLOAD_MAX_MB` (megabytes, may be fractional). Anything that is not a finite positive
 * number falls back to the default: a typo must never turn into "no limit".
 */
export function resolveMaxUploadBytes(value: string | undefined): number {
  const mb = Number(value);
  if (!value || !Number.isFinite(mb) || mb <= 0) {
    return DEFAULT_MAX_UPLOAD_BYTES;
  }
  return Math.floor(mb * 1024 * 1024);
}

export function uploadMulterOptions(
  config: ConfigService,
): MulterModuleOptions {
  return {
    storage: memoryStorage(),
    limits: {
      fileSize: resolveMaxUploadBytes(config.get<string>('UPLOAD_MAX_MB')),
    },
    fileFilter: imageMimeFilter,
  };
}
