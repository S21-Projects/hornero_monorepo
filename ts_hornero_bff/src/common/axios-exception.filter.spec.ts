import { ArgumentsHost, HttpStatus, UnauthorizedException } from '@nestjs/common';
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

      const err = new AxiosError('Request failed', undefined, undefined, undefined, {
        status: 404,
        statusText: 'Not Found',
        headers: {},
        config: {} as any,
        data: msEnvelope,
      });

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
      expect(body.message).toBe('Network Error');
      expect(body.data).toBeNull();
      expect(body.errors).toEqual(['Network Error']);
      expect(typeof body.timestamp).toBe('string');
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
});
