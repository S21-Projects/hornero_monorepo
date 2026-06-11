import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { isAxiosError } from 'axios';
import type { Response } from 'express';

@Catch()
export class AxiosExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('AxiosExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (isAxiosError(exception)) {
      const status = exception.response?.status ?? HttpStatus.BAD_GATEWAY;
      const message = exception.response?.data?.message ?? exception.message;
      this.logger.error(`MS error ${status}: ${message} [${exception.config?.url}]`);
      response.status(status).json({ statusCode: status, message });
      return;
    }

    // Re-throw non-Axios errors so NestJS default handler takes over
    throw exception;
  }
}
