import { Test, TestingModule } from '@nestjs/testing';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from '../auth/decorators/public.decorator.js';
import { ROLES_KEY } from '../auth/decorators/roles.decorator.js';
import { Role } from '../common/enums/role.enum.js';
import { ArticulosController } from './articulos.controller';
import { ArticulosService } from './articulos.service';

describe('ArticulosController', () => {
  let controller: ArticulosController;
  let service: {
    listar: jest.Mock;
    crear: jest.Mock;
    actualizar: jest.Mock;
    desactivar: jest.Mock;
    reactivar: jest.Mock;
  };

  const requestWithToken = (token?: string) =>
    ({ cookies: token ? { access_token: token } : {} }) as unknown as Request;

  beforeEach(async () => {
    service = {
      listar: jest.fn(),
      crear: jest.fn(),
      actualizar: jest.fn(),
      desactivar: jest.fn(),
      reactivar: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ArticulosController],
      providers: [{ provide: ArticulosService, useValue: service }],
    }).compile();

    controller = module.get<ArticulosController>(ArticulosController);
  });

  const rolesOf = (methodName: keyof ArticulosController): Role[] =>
    Reflect.getMetadata(ROLES_KEY, ArticulosController.prototype[methodName]) ??
    [];

  const isPublic = (methodName: keyof ArticulosController): boolean =>
    Reflect.getMetadata(
      IS_PUBLIC_KEY,
      ArticulosController.prototype[methodName],
    ) ?? false;

  describe('listar', () => {
    it('is public', () => {
      expect(isPublic('listar')).toBe(true);
    });

    it('forwards incluirInactivos=false when the query param is absent', async () => {
      service.listar.mockResolvedValue([]);

      await controller.listar();

      expect(service.listar).toHaveBeenCalledWith(false);
    });

    it('forwards incluirInactivos=true when the query param is "true"', async () => {
      service.listar.mockResolvedValue([]);

      await controller.listar('true');

      expect(service.listar).toHaveBeenCalledWith(true);
    });
  });

  describe('crear', () => {
    it('is restricted to ADMINISTRADOR', () => {
      expect(rolesOf('crear')).toEqual([Role.ADMINISTRADOR]);
    });

    it('reads the access_token cookie and forwards the dto to the service', async () => {
      const articulo = { id: 1, nombre: 'Arroz' };
      service.crear.mockResolvedValue(articulo);
      const dto = { nombre: 'Arroz', categoria: 'NO_PERECEDERO', unidad: 'KG' };

      const result = await controller.crear(dto, requestWithToken('token-123'));

      expect(service.crear).toHaveBeenCalledWith(dto, 'token-123');
      expect(result).toBe(articulo);
    });

    it('throws UnauthorizedException when no access_token cookie is present', () => {
      expect(() => controller.crear({} as any, requestWithToken())).toThrow(
        'No access token',
      );
    });
  });

  describe('actualizar', () => {
    it('is restricted to ADMINISTRADOR', () => {
      expect(rolesOf('actualizar')).toEqual([Role.ADMINISTRADOR]);
    });

    it('reads the access_token cookie and forwards id + dto to the service', async () => {
      const articulo = { id: 1, nombre: 'Arroz Integral' };
      service.actualizar.mockResolvedValue(articulo);
      const dto = {
        nombre: 'Arroz Integral',
        categoria: 'NO_PERECEDERO',
        unidad: 'KG',
      };

      const result = await controller.actualizar(
        1,
        dto,
        requestWithToken('token-123'),
      );

      expect(service.actualizar).toHaveBeenCalledWith(1, dto, 'token-123');
      expect(result).toBe(articulo);
    });
  });

  describe('desactivar', () => {
    it('is restricted to ADMINISTRADOR', () => {
      expect(rolesOf('desactivar')).toEqual([Role.ADMINISTRADOR]);
    });

    it('reads the access_token cookie and forwards id to the service', async () => {
      const articulo = { id: 1, activo: false };
      service.desactivar.mockResolvedValue(articulo);

      const result = await controller.desactivar(
        1,
        requestWithToken('token-123'),
      );

      expect(service.desactivar).toHaveBeenCalledWith(1, 'token-123');
      expect(result).toBe(articulo);
    });
  });

  describe('reactivar', () => {
    it('is restricted to ADMINISTRADOR', () => {
      expect(rolesOf('reactivar')).toEqual([Role.ADMINISTRADOR]);
    });

    it('reads the access_token cookie and forwards id to the service', async () => {
      const articulo = { id: 1, activo: true };
      service.reactivar.mockResolvedValue(articulo);

      const result = await controller.reactivar(
        1,
        requestWithToken('token-123'),
      );

      expect(service.reactivar).toHaveBeenCalledWith(1, 'token-123');
      expect(result).toBe(articulo);
    });
  });
});
