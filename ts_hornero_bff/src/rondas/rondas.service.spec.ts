import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { RondasService } from './rondas.service';

describe('RondasService', () => {
  let service: RondasService;
  let httpService: { axiosRef: { get: jest.Mock; post: jest.Mock } };
  let configService: { get: jest.Mock };

  beforeEach(async () => {
    httpService = {
      axiosRef: { get: jest.fn(), post: jest.fn() },
    };
    configService = { get: jest.fn().mockReturnValue('http://ms:8081') };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RondasService,
        { provide: HttpService, useValue: httpService },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get<RondasService>(RondasService);
  });

  describe('ejecutar', () => {
    it('POSTs the MS /rondas endpoint with a Bearer header', async () => {
      const data = { id: 1, estado: 'COMPLETADA' };
      httpService.axiosRef.post.mockResolvedValue({ data });

      const result = await service.ejecutar('token-123');

      expect(httpService.axiosRef.post).toHaveBeenCalledWith(
        'http://ms:8081/api/rondas',
        null,
        { headers: { Authorization: 'Bearer token-123' } },
      );
      expect(result).toEqual(data);
    });

    it('rethrows an MS error response unchanged (e.g. 409 RONDA_EN_CURSO)', async () => {
      const error = {
        isAxiosError: true,
        response: { status: 409, data: { message: 'RONDA_EN_CURSO' } },
      };
      httpService.axiosRef.post.mockRejectedValue(error);

      await expect(service.ejecutar('token-123')).rejects.toBe(error);
    });

    it('rethrows a 503 WORKER_NO_DISPONIBLE response unchanged', async () => {
      const error = {
        isAxiosError: true,
        response: { status: 503, data: { message: 'WORKER_NO_DISPONIBLE' } },
      };
      httpService.axiosRef.post.mockRejectedValue(error);

      await expect(service.ejecutar('token-123')).rejects.toBe(error);
    });
  });

  describe('listar', () => {
    it('GETs the MS /rondas endpoint with a Bearer header and no query params', async () => {
      const data = { content: [], totalElements: 0 };
      httpService.axiosRef.get.mockResolvedValue({ data });

      const result = await service.listar('token-123');

      expect(httpService.axiosRef.get).toHaveBeenCalledWith(
        'http://ms:8081/api/rondas',
        { headers: { Authorization: 'Bearer token-123' } },
      );
      expect(result).toEqual(data);
    });

    it('forwards page/size/sort query params to the MS', async () => {
      const data = { content: [], totalElements: 0 };
      httpService.axiosRef.get.mockResolvedValue({ data });

      await service.listar('token-123', '0', '20', 'ejecutadaEn,desc');

      expect(httpService.axiosRef.get).toHaveBeenCalledWith(
        'http://ms:8081/api/rondas?page=0&size=20&sort=ejecutadaEn%2Cdesc',
        { headers: { Authorization: 'Bearer token-123' } },
      );
    });
  });

  describe('detalle', () => {
    it('GETs the MS /rondas/{id} endpoint with a Bearer header', async () => {
      const data = { id: 1, estado: 'COMPLETADA' };
      httpService.axiosRef.get.mockResolvedValue({ data });

      const result = await service.detalle(1, 'token-123');

      expect(httpService.axiosRef.get).toHaveBeenCalledWith(
        'http://ms:8081/api/rondas/1',
        { headers: { Authorization: 'Bearer token-123' } },
      );
      expect(result).toEqual(data);
    });
  });

  describe('fondo', () => {
    it('GETs the MS /rondas/fondo endpoint with a Bearer header', async () => {
      const data = { pendientes: 3, masAntiguaDesde: '2026-09-01' };
      httpService.axiosRef.get.mockResolvedValue({ data });

      const result = await service.fondo('token-123');

      expect(httpService.axiosRef.get).toHaveBeenCalledWith(
        'http://ms:8081/api/rondas/fondo',
        { headers: { Authorization: 'Bearer token-123' } },
      );
      expect(result).toEqual(data);
    });
  });
});
