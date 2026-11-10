import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { OrganizacionesService } from './organizaciones.service';

describe('OrganizacionesService', () => {
  let service: OrganizacionesService;
  let httpService: { axiosRef: { get: jest.Mock; patch: jest.Mock } };
  let configService: { get: jest.Mock };

  beforeEach(async () => {
    httpService = { axiosRef: { get: jest.fn(), patch: jest.fn() } };
    configService = { get: jest.fn().mockReturnValue('http://ms:8081') };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrganizacionesService,
        { provide: HttpService, useValue: httpService },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get<OrganizacionesService>(OrganizacionesService);
  });

  describe('asignarReferente', () => {
    it('forwards the Bearer header and the dto to the MS reassign endpoint', async () => {
      const data = { id: 5, referenteId: 3 };
      httpService.axiosRef.patch.mockResolvedValue({ data });

      const result = await service.asignarReferente(
        5,
        { referenteId: 3 },
        'token-123',
      );

      expect(httpService.axiosRef.patch).toHaveBeenCalledWith(
        'http://ms:8081/api/organizaciones/5/referente',
        { referenteId: 3 },
        { headers: { Authorization: 'Bearer token-123' } },
      );
      expect(result).toEqual(data);
    });

    it('forwards a null referenteId to unassign', async () => {
      const data = { id: 5, referenteId: null };
      httpService.axiosRef.patch.mockResolvedValue({ data });

      await service.asignarReferente(5, { referenteId: null }, 'token-123');

      expect(httpService.axiosRef.patch).toHaveBeenCalledWith(
        'http://ms:8081/api/organizaciones/5/referente',
        { referenteId: null },
        { headers: { Authorization: 'Bearer token-123' } },
      );
    });
  });

  describe('mapa', () => {
    it('proxies the public MS map endpoint without credentials', async () => {
      const data = { data: [{ id: 1, slug: 'a', estado: 'SIN_RECLAMAR', necesidadesAbiertas: 2 }] };
      httpService.axiosRef.get.mockResolvedValue({ data });

      const result = await service.mapa();

      expect(httpService.axiosRef.get).toHaveBeenCalledWith(
        'http://ms:8081/api/organizaciones/mapa',
      );
      expect(result).toEqual(data);
    });
  });

  describe('mapaZona', () => {
    it('forwards the four box params to the public MS endpoint without credentials', async () => {
      const data = { data: { pins: [], truncated: false } };
      httpService.axiosRef.get.mockResolvedValue({ data });

      const result = await service.mapaZona('-35', '-34', '-59', '-58');

      expect(httpService.axiosRef.get).toHaveBeenCalledWith(
        'http://ms:8081/api/organizaciones/mapa/zona?minLat=-35&maxLat=-34&minLng=-59&maxLng=-58',
      );
      expect(result).toEqual(data);
    });

    it('omits missing params so the MS answers 400', async () => {
      httpService.axiosRef.get.mockResolvedValue({ data: {} });

      await service.mapaZona('-35', undefined, '-59', '-58');

      expect(httpService.axiosRef.get).toHaveBeenCalledWith(
        'http://ms:8081/api/organizaciones/mapa/zona?minLat=-35&minLng=-59&maxLng=-58',
      );
    });
  });

  describe('listarTodas', () => {
    it('forwards filters and paging to the MS with the Bearer header, comma intact', async () => {
      const data = { data: { totalElements: 0, content: [] } };
      httpService.axiosRef.get.mockResolvedValue({ data });

      const result = await service.listarTodas('tok', {
        sinReferente: 'true',
        referenteIds: '1,2,3',
        q: 'sol y luna',
        page: '2',
        size: '20',
      });

      expect(httpService.axiosRef.get).toHaveBeenCalledWith(
        'http://ms:8081/api/organizaciones/todas?sinReferente=true&referenteIds=1%2C2%2C3&q=sol+y+luna&page=2&size=20',
        { headers: { Authorization: 'Bearer tok' } },
      );
      expect(result).toEqual(data);
    });

    it('sends no query string when no params are given', async () => {
      httpService.axiosRef.get.mockResolvedValue({ data: {} });

      await service.listarTodas('tok');

      expect(httpService.axiosRef.get).toHaveBeenCalledWith(
        'http://ms:8081/api/organizaciones/todas',
        { headers: { Authorization: 'Bearer tok' } },
      );
    });
  });

  describe('misOrganizaciones', () => {
    it('forwards the Bearer header to the MS mia endpoint', async () => {
      const data = [{ id: 1 }, { id: 2 }];
      httpService.axiosRef.get.mockResolvedValue({ data });

      const result = await service.misOrganizaciones('token-123');

      expect(httpService.axiosRef.get).toHaveBeenCalledWith(
        'http://ms:8081/api/organizaciones/mia',
        { headers: { Authorization: 'Bearer token-123' } },
      );
      expect(result).toEqual(data);
    });
  });

  describe('actualizarInfoPublica', () => {
    it('forwards the Bearer header and dto to the MS admin info-publica endpoint', async () => {
      const data = { id: 5, sitioWebUrl: 'https://example.org' };
      httpService.axiosRef.patch.mockResolvedValue({ data });

      const result = await service.actualizarInfoPublica(
        5,
        { sitioWebUrl: 'https://example.org' },
        'token-123',
      );

      expect(httpService.axiosRef.patch).toHaveBeenCalledWith(
        'http://ms:8081/api/organizaciones/5/info-publica',
        { sitioWebUrl: 'https://example.org' },
        { headers: { Authorization: 'Bearer token-123' } },
      );
      expect(result).toEqual(data);
    });
  });

  describe('aprobarInfoPublica', () => {
    it('forwards the Bearer header to the MS aprobar endpoint', async () => {
      const data = { id: 5, infoPublicaPendienteEn: null };
      httpService.axiosRef.patch.mockResolvedValue({ data });

      const result = await service.aprobarInfoPublica(5, 'token-123');

      expect(httpService.axiosRef.patch).toHaveBeenCalledWith(
        'http://ms:8081/api/organizaciones/5/info-publica/aprobar',
        {},
        { headers: { Authorization: 'Bearer token-123' } },
      );
      expect(result).toEqual(data);
    });
  });

  describe('rechazarInfoPublica', () => {
    it('forwards the Bearer header to the MS rechazar endpoint', async () => {
      const data = { id: 5, infoPublicaPendienteEn: null };
      httpService.axiosRef.patch.mockResolvedValue({ data });

      const result = await service.rechazarInfoPublica(5, 'token-123');

      expect(httpService.axiosRef.patch).toHaveBeenCalledWith(
        'http://ms:8081/api/organizaciones/5/info-publica/rechazar',
        {},
        { headers: { Authorization: 'Bearer token-123' } },
      );
      expect(result).toEqual(data);
    });
  });
});
