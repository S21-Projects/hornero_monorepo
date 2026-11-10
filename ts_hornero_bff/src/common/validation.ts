import type { ValidationPipeOptions } from '@nestjs/common';

/** Options of the global ValidationPipe; shared by `main.ts` and its spec. */
export const VALIDATION_PIPE_OPTIONS: ValidationPipeOptions = {
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
};
