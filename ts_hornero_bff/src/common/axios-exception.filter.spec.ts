import {
  ArgumentsHost,
  BadRequestException,
  HttpStatus,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { AxiosError } from 'axios';
import { AxiosExceptionFilter } from './axios-exception.filter';

function buildMockHost(json: jest.Mock): ArgumentsHost {
  return {
    switchToHttp: () => ({
      getResponse: () => ({
        status: jest.fn().mockReturnThis(),
        json,
      }),
    }),
  } as unknown as ArgumentsHost;
}

describe('AxiosExceptionFilter', () => {
  let filter: AxiosExceptionFilter;

  beforeEach(() => {
    filter = new AxiosExceptionFilter();
  });

  describe('Case 1 — MS error with envelope', () => {
    it('relays the MS envelope object unchanged', () => {
      const msEnvelope = {
        status: 404,
        message: 'Not found',
        timestamp: '2024-01-01T00:00:00Z',
        data: null,
        errors: ['Resource not found'],
      };

      const json = jest.fn();
      const host = buildMockHost(json);

      const err = new AxiosError(
        'Request failed',
        undefined,
        undefined,
        undefined,
        {
          status: 404,
          statusText: 'Not Found',
          headers: {},
          config: {} as any,
          data: msEnvelope,
        },
      );

      filter.catch(err, host);

      expect(json).toHaveBeenCalledWith(msEnvelope);
    });
  });

  describe('Case 2 — Axios error without MS envelope', () => {
    it('emits own envelope with status, message, timestamp, data:null, errors', () => {
      const json = jest.fn();
      const host = buildMockHost(json);

      const err = new AxiosError('Network Error');

      filter.catch(err, host);

      const body = json.mock.calls[0][0];
      expect(body.status).toBe(HttpStatus.BAD_GATEWAY);
      expect(body.message).toBe('Upstream service unavailable');
      expect(body.data).toBeNull();
      expect(body.errors).toEqual(['Upstream service unavailable']);
      expect(typeof body.timestamp).toBe('string');
    });

    it('does not leak the raw axios message and logs it server-side', () => {
      const json = jest.fn();
      const logSpy = jest
        .spyOn(Logger.prototype, 'error')
        .mockImplementation(() => undefined);

      filter.catch(
        new AxiosError('connect ECONNREFUSED 10.0.0.5:8081'),
        buildMockHost(json),
      );

      expect(JSON.stringify(json.mock.calls[0][0])).not.toContain('10.0.0.5');
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('ECONNREFUSED 10.0.0.5:8081'),
      );
      logSpy.mockRestore();
    });

    it('keeps the upstream status but hides the upstream message when the body is not an envelope', () => {
      const json = jest.fn();
      const err = new AxiosError(
        'Request failed with status code 503',
        undefined,
        undefined,
        undefined,
        {
          status: 503,
          statusText: 'Service Unavailable',
          headers: {},
          config: {} as any,
          data: '<html>nginx upstream detail</html>',
        },
      );

      filter.catch(err, buildMockHost(json));

      const body = json.mock.calls[0][0];
      expect(body.status).toBe(503);
      expect(body.message).toBe('Upstream service unavailable');
      expect(JSON.stringify(body)).not.toContain('status code 503');
    });
  });

  describe('Case 3 — UnauthorizedException', () => {
    it('emits envelope shape instead of Nest default', () => {
      const json = jest.fn();
      const host = buildMockHost(json);

      filter.catch(new UnauthorizedException('No access token'), host);

      const body = json.mock.calls[0][0];
      expect(body.status).toBe(401);
      expect(body.data).toBeNull();
      expect(Array.isArray(body.errors)).toBe(true);
      expect(typeof body.timestamp).toBe('string');
    });
  });

  describe('Case 4 — NestJS HttpException passthrough', () => {
    it('keeps the exception status and message', () => {
      const json = jest.fn();
      filter.catch(
        new BadRequestException('property foo should not exist'),
        buildMockHost(json),
      );

      const body = json.mock.calls[0][0];
      expect(body.status).toBe(400);
      expect(body.message).toBe('property foo should not exist');
    });
  });

  describe('Case 5 — unknown errors', () => {
    it('returns a generic 500 message and logs the real error', () => {
      const json = jest.fn();
      const logSpy = jest
        .spyOn(Logger.prototype, 'error')
        .mockImplementation(() => undefined);
      const boom = new Error('relation "usuarios" does not exist');

      filter.catch(boom, buildMockHost(json));

      const body = json.mock.calls[0][0];
      expect(body.status).toBe(500);
      expect(body.message).toBe('Internal server error');
      expect(body.errors).toEqual(['Internal server error']);
      expect(JSON.stringify(body)).not.toContain('usuarios');
      expect(logSpy).toHaveBeenCalledWith('Unexpected error:', boom);
      logSpy.mockRestore();
    });
  });
});
