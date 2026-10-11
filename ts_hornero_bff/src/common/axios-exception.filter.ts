import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
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
    const timestamp = new Date().toISOString();

    // --- Axios errors (upstream MS calls) ---
    if (isAxiosError(exception)) {
      const upstreamData = exception.response?.data;

      if (upstreamData?.status) {
        // The MS returned a well-formed envelope — relay it unchanged.
        const httpStatus = exception.response!.status;
        this.logger.error(
          `MS error ${httpStatus}: ${upstreamData.message} [${exception.config?.url}]`,
        );
        response.status(httpStatus).json(upstreamData);
        return;
      }

      // Axios error without an MS envelope (e.g. network timeout, BFF misconfiguration).
      const httpStatus = exception.response?.status ?? HttpStatus.BAD_GATEWAY;
      // The raw axios message can expose internal hosts/ports; log it, never send it.
      const message = 'Upstream service unavailable';
      this.logger.error(
        `BFF axios error ${httpStatus}: ${exception.message} [${exception.config?.url}]`,
      );
      response.status(httpStatus).json({
        status: httpStatus,
        message,
        timestamp,
        data: null,
        errors: [message],
      });
      return;
    }

    // --- NestJS HTTP exceptions (UnauthorizedException, BadRequestException, etc.) ---
    if (exception instanceof HttpException) {
      const httpStatus = exception.getStatus();
      // ValidationPipe puts one string per violated constraint in `message`; keep them (same shape
      // as the MS handler: message = first, errors = all) so clients can map stable codes.
      const body = exception.getResponse();
      const fieldMessages =
        typeof body === 'object' &&
        body !== null &&
        Array.isArray((body as { message?: unknown }).message) &&
        (body as { message: unknown[] }).message.every(
          (m) => typeof m === 'string',
        ) &&
        (body as { message: string[] }).message.length > 0
          ? (body as { message: string[] }).message
          : null;
      const message = fieldMessages ? fieldMessages[0] : exception.message;
      response.status(httpStatus).json({
        status: httpStatus,
        message,
        timestamp,
        data: null,
        errors: fieldMessages ?? [message],
      });
      return;
    }

    // --- Unknown / unexpected errors ---
    // Never relay the raw message (may expose SQL, paths or internals); it is logged below.
    const message = 'Internal server error';
    this.logger.error('Unexpected error:', exception);
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      message,
      timestamp,
      data: null,
      errors: [message],
    });
  }
}
