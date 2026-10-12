import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { DonacionesService } from './donaciones.service';

describe('DonacionesService', () => {
  let service: DonacionesService;
  let httpService: {
    axiosRef: { get: jest.Mock; post: jest.Mock; patch: jest.Mock };
  };
  let configService: { get: jest.Mock };

  beforeEach(async () => {
    httpService = {
      axiosRef: { get: jest.fn(), post: jest.fn(), patch: jest.fn() },
    };
    configService = { get: jest.fn().mockReturnValue('http://ms:8081') };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DonacionesService,
        { provide: HttpService, useValue: httpService },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get<DonacionesService>(DonacionesService);
  });

  describe('optional session on public reads', () => {
    beforeEach(() => {
      httpService.axiosRef.get.mockResolvedValue({ data: {} });
    });

    it('findById forwards the Bearer token when present', async () => {
      await service.findById(5, 'token-123');
      expect(httpService.axiosRef.get).toHaveBeenCalledWith(
        'http://ms:8081/api/donaciones/5',
        { headers: { Authorization: 'Bearer token-123' } },
      );
    });

    it('findById sends no Authorization header when anonymous', async () => {
      await service.findById(5);
      expect(httpService.axiosRef.get).toHaveBeenCalledWith(
        'http://ms:8081/api/donaciones/5',
        { headers: {} },
      );
    });

    it('getDonaciones forwards the Bearer token when present', async () => {
      await service.getDonaciones('10', undefined, undefined, undefined, 'tk');
      const [url, config] = httpService.axiosRef.get.mock.calls[0];
      expect(url).toContain('/api/donaciones?organizacionId=10');
      expect(config).toEqual({ headers: { Authorization: 'Bearer tk' } });
    });

    it('getDonaciones sends no Authorization header when anonymous', async () => {
      await service.getDonaciones('10');
      expect(httpService.axiosRef.get.mock.calls[0][1]).toEqual({
        headers: {},
      });
    });
  });

  describe('findDeMiOrganizacion', () => {
    it('forwards the access token as a Bearer header to the MS mi-organizacion endpoint', async () => {
      const data = [{ id: 1, organizacionId: 10, estado: 'OFRECIDA' }];
      httpService.axiosRef.get.mockResolvedValue({ data });

      const result = await service.findDeMiOrganizacion('token-123');

      expect(httpService.axiosRef.get).toHaveBeenCalledWith(
        'http://ms:8081/api/donaciones/mi-organizacion',
        { headers: { Authorization: 'Bearer token-123' } },
      );
      expect(result).toEqual(data);
    });

    it('forwards an optional organizacionId query param', async () => {
      const data = [{ id: 1, organizacionId: 10, estado: 'OFRECIDA' }];
      httpService.axiosRef.get.mockResolvedValue({ data });

      await service.findDeMiOrganizacion('token-123', '10');

      expect(httpService.axiosRef.get).toHaveBeenCalledWith(
        'http://ms:8081/api/donaciones/mi-organizacion?organizacionId=10',
        { headers: { Authorization: 'Bearer token-123' } },
      );
    });
  });

  describe('decidir', () => {
    it('PATCHes the MS /decision endpoint with a Bearer header', async () => {
      const data = { id: 1, estado: 'ACEPTADA' };
      httpService.axiosRef.patch.mockResolvedValue({ data });
      const dto = { estado: 'ACEPTADA' };

      const result = await service.decidir(1, dto, 'token-123');

      expect(httpService.axiosRef.patch).toHaveBeenCalledWith(
        'http://ms:8081/api/donaciones/1/decision',
        dto,
        { headers: { Authorization: 'Bearer token-123' } },
      );
      expect(result).toEqual(data);
    });
  });

  describe('overrideEstado', () => {
    it('PATCHes the MS /estado-admin endpoint with a Bearer header', async () => {
      const data = { id: 1, estado: 'CANCELADA' };
      httpService.axiosRef.patch.mockResolvedValue({ data });
      const dto = { estado: 'CANCELADA', motivo: 'Duplicada' };

      const result = await service.overrideEstado(1, dto, 'token-123');

      expect(httpService.axiosRef.patch).toHaveBeenCalledWith(
        'http://ms:8081/api/donaciones/1/estado-admin',
        dto,
        { headers: { Authorization: 'Bearer token-123' } },
      );
      expect(result).toEqual(data);
    });
  });

  describe('asignaciones', () => {
    it('GETs the MS /asignaciones endpoint with a Bearer header', async () => {
      const data = [{ id: 1, estado: 'PROPUESTA' }];
      httpService.axiosRef.get.mockResolvedValue({ data });

      const result = await service.asignaciones(1, 'token-123');

      expect(httpService.axiosRef.get).toHaveBeenCalledWith(
        'http://ms:8081/api/donaciones/1/asignaciones',
        { headers: { Authorization: 'Bearer token-123' } },
      );
      expect(result).toEqual(data);
    });

    it('rethrows an MS error response unchanged', async () => {
      const error = {
        isAxiosError: true,
        response: { status: 403, data: { message: 'Access denied' } },
      };
      httpService.axiosRef.get.mockRejectedValue(error);

      await expect(service.asignaciones(1, 'token-123')).rejects.toBe(error);
    });
  });

  describe('findActivas', () => {
    it('GETs the MS /activas endpoint with a Bearer header and no query params', async () => {
      const data = { content: [], totalElements: 0 };
      httpService.axiosRef.get.mockResolvedValue({ data });

      const result = await service.findActivas('token-123');

      expect(httpService.axiosRef.get).toHaveBeenCalledWith(
        'http://ms:8081/api/donaciones/activas',
        { headers: { Authorization: 'Bearer token-123' } },
      );
      expect(result).toEqual(data);
    });

    it('forwards page/size/sort/q/estado query params to the MS', async () => {
      const data = { content: [], totalElements: 0 };
      httpService.axiosRef.get.mockResolvedValue({ data });

      await service.findActivas(
        'token-123',
        '0',
        '20',
        'fechaOferta,desc',
        'org',
        'OFRECIDA',
      );

      expect(httpService.axiosRef.get).toHaveBeenCalledWith(
        'http://ms:8081/api/donaciones/activas?page=0&size=20&sort=fechaOferta%2Cdesc&q=org&estado=OFRECIDA',
        { headers: { Authorization: 'Bearer token-123' } },
      );
    });
  });

  describe('findActivas estancadas (N12)', () => {
    it('forwards the estancadas filter to the MS', async () => {
      httpService.axiosRef.get.mockResolvedValue({ data: {} });

      await service.findActivas(
        'token-123',
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        'true',
      );

      expect(httpService.axiosRef.get).toHaveBeenCalledWith(
        'http://ms:8081/api/donaciones/activas?estancadas=true',
        { headers: { Authorization: 'Bearer token-123' } },
      );
    });
  });

  describe('generarCodigoEntrega', () => {
    it('POSTs the MS /entrega/codigo endpoint with a Bearer header', async () => {
      const data = { codigo: '482913', expiraEn: '2026-09-30T12:10:00Z' };
      httpService.axiosRef.post.mockResolvedValue({ data });

      const result = await service.generarCodigoEntrega(1, 'token-123');

      expect(httpService.axiosRef.post).toHaveBeenCalledWith(
        'http://ms:8081/api/donaciones/1/entrega/codigo',
        null,
        { headers: { Authorization: 'Bearer token-123' } },
      );
      expect(result).toEqual(data);
    });

    it('rethrows an MS error response unchanged', async () => {
      const error = {
        isAxiosError: true,
        response: {
          status: 429,
          data: { message: 'ESPERA_ANTES_DE_REENVIAR' },
        },
      };
      httpService.axiosRef.post.mockRejectedValue(error);

      await expect(service.generarCodigoEntrega(1, 'token-123')).rejects.toBe(
        error,
      );
    });
  });

  describe('verificarCodigoEntrega', () => {
    it('POSTs the MS /entrega/verificar endpoint with the dto and a Bearer header', async () => {
      const data = {
        estado: 'PENDIENTE_CONFIRMACION',
        confirmadaDonanteEn: null,
        confirmadaReferenteEn: '2026-09-30T12:00:00Z',
      };
      httpService.axiosRef.post.mockResolvedValue({ data });
      const dto = { codigo: '482913' };

      const result = await service.verificarCodigoEntrega(1, dto, 'token-123');

      expect(httpService.axiosRef.post).toHaveBeenCalledWith(
        'http://ms:8081/api/donaciones/1/entrega/verificar',
        dto,
        { headers: { Authorization: 'Bearer token-123' } },
      );
      expect(result).toEqual(data);
    });

    it('rethrows an MS error response unchanged', async () => {
      const error = {
        isAxiosError: true,
        response: { status: 410, data: { message: 'CODIGO_EXPIRADO' } },
      };
      httpService.axiosRef.post.mockRejectedValue(error);

      await expect(
        service.verificarCodigoEntrega(1, { codigo: '000000' }, 'token-123'),
      ).rejects.toBe(error);
    });
  });

  describe('estadoEntrega', () => {
    it('GETs the MS /entrega endpoint with a Bearer header', async () => {
      const data = {
        estado: 'EN_CAMINO',
        confirmadaDonanteEn: null,
        confirmadaReferenteEn: null,
      };
      httpService.axiosRef.get.mockResolvedValue({ data });

      const result = await service.estadoEntrega(1, 'token-123');

      expect(httpService.axiosRef.get).toHaveBeenCalledWith(
        'http://ms:8081/api/donaciones/1/entrega',
        { headers: { Authorization: 'Bearer token-123' } },
      );
      expect(result).toEqual(data);
    });

    it('rethrows an MS error response unchanged', async () => {
      const error = {
        isAxiosError: true,
        response: { status: 403, data: { message: 'Access denied' } },
      };
      httpService.axiosRef.get.mockRejectedValue(error);

      await expect(service.estadoEntrega(1, 'token-123')).rejects.toBe(error);
    });
  });
});
