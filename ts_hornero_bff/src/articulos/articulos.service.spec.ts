import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { ArticulosService } from './articulos.service';

describe('ArticulosService', () => {
  let service: ArticulosService;
  let httpService: {
    axiosRef: {
      get: jest.Mock;
      post: jest.Mock;
      put: jest.Mock;
      patch: jest.Mock;
    };
  };
  let configService: { get: jest.Mock };

  beforeEach(async () => {
    httpService = {
      axiosRef: {
        get: jest.fn(),
        post: jest.fn(),
        put: jest.fn(),
        patch: jest.fn(),
      },
    };
    configService = { get: jest.fn().mockReturnValue('http://ms:8081') };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ArticulosService,
        { provide: HttpService, useValue: httpService },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get<ArticulosService>(ArticulosService);
  });

  describe('listar', () => {
    it('lists with no query string when incluirInactivos is false', async () => {
      const data = [{ id: 1, nombre: 'Arroz', activo: true }];
      httpService.axiosRef.get.mockResolvedValue({ data });

      const result = await service.listar(false);

      expect(httpService.axiosRef.get).toHaveBeenCalledWith(
        'http://ms:8081/api/articulos',
      );
      expect(result).toEqual(data);
    });

    it('includes incluirInactivos=true when requested', async () => {
      const data = [{ id: 1, nombre: 'Arroz', activo: false }];
      httpService.axiosRef.get.mockResolvedValue({ data });

      await service.listar(true);

      expect(httpService.axiosRef.get).toHaveBeenCalledWith(
        'http://ms:8081/api/articulos?incluirInactivos=true',
      );
    });
  });

  describe('listarAdmin', () => {
    it('GETs the MS admin list with the bearer token and no query when no filter is given', async () => {
      httpService.axiosRef.get.mockResolvedValue({ data: { content: [] } });

      const res = await service.listarAdmin('tok');

      expect(httpService.axiosRef.get).toHaveBeenCalledWith(
        'http://ms:8081/api/articulos/admin',
        { headers: { Authorization: 'Bearer tok' } },
      );
      expect(res).toEqual({ content: [] });
    });

    it('forwards q, categoria, incluirInactivos and paging, percent-encoding the search text', async () => {
      httpService.axiosRef.get.mockResolvedValue({ data: {} });

      await service.listarAdmin('tok', {
        q: 'leche&x=1',
        categoria: 'REFRIGERADO',
        incluirInactivos: 'true',
        page: '2',
        size: '10',
      });

      expect(httpService.axiosRef.get).toHaveBeenCalledWith(
        'http://ms:8081/api/articulos/admin?q=leche%26x%3D1&categoria=REFRIGERADO&incluirInactivos=true&page=2&size=10',
        { headers: { Authorization: 'Bearer tok' } },
      );
    });
  });

  describe('crear', () => {
    it('forwards the Bearer header and the dto to the MS create endpoint', async () => {
      const data = { id: 1, nombre: 'Arroz' };
      httpService.axiosRef.post.mockResolvedValue({ data });
      const dto = { nombre: 'Arroz', categoria: 'NO_PERECEDERO', unidad: 'KG' };

      const result = await service.crear(dto, 'token-123');

      expect(httpService.axiosRef.post).toHaveBeenCalledWith(
        'http://ms:8081/api/articulos',
        dto,
        { headers: { Authorization: 'Bearer token-123' } },
      );
      expect(result).toEqual(data);
    });
  });

  describe('actualizar', () => {
    it('forwards the Bearer header and the dto to the MS edit endpoint', async () => {
      const data = { id: 1, nombre: 'Arroz Integral' };
      httpService.axiosRef.put.mockResolvedValue({ data });
      const dto = {
        nombre: 'Arroz Integral',
        categoria: 'NO_PERECEDERO',
        unidad: 'KG',
      };

      const result = await service.actualizar(1, dto, 'token-123');

      expect(httpService.axiosRef.put).toHaveBeenCalledWith(
        'http://ms:8081/api/articulos/1',
        dto,
        { headers: { Authorization: 'Bearer token-123' } },
      );
      expect(result).toEqual(data);
    });
  });

  describe('desactivar', () => {
    it('forwards the Bearer header to the MS deactivate endpoint', async () => {
      const data = { id: 1, activo: false };
      httpService.axiosRef.patch.mockResolvedValue({ data });

      const result = await service.desactivar(1, 'token-123');

      expect(httpService.axiosRef.patch).toHaveBeenCalledWith(
        'http://ms:8081/api/articulos/1/desactivar',
        {},
        { headers: { Authorization: 'Bearer token-123' } },
      );
      expect(result).toEqual(data);
    });
  });

  describe('reactivar', () => {
    it('forwards the Bearer header to the MS reactivate endpoint', async () => {
      const data = { id: 1, activo: true };
      httpService.axiosRef.patch.mockResolvedValue({ data });

      const result = await service.reactivar(1, 'token-123');

      expect(httpService.axiosRef.patch).toHaveBeenCalledWith(
        'http://ms:8081/api/articulos/1/reactivar',
        {},
        { headers: { Authorization: 'Bearer token-123' } },
      );
      expect(result).toEqual(data);
    });
  });
});
