import { Test, TestingModule } from '@nestjs/testing';
import type { Request } from 'express';
import { ROLES_KEY } from '../auth/decorators/roles.decorator.js';
import { Role } from '../common/enums/role.enum.js';
import { RondasController } from './rondas.controller';
import { RondasService } from './rondas.service';

describe('RondasController', () => {
  let controller: RondasController;
  let service: {
    ejecutar: jest.Mock;
    listar: jest.Mock;
    detalle: jest.Mock;
    fondo: jest.Mock;
    asignaciones: jest.Mock;
  };

  const requestWithToken = (token?: string) =>
    ({ cookies: token ? { access_token: token } : {} }) as unknown as Request;

  beforeEach(async () => {
    service = {
      ejecutar: jest.fn(),
      listar: jest.fn(),
      detalle: jest.fn(),
      fondo: jest.fn(),
      asignaciones: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [RondasController],
      providers: [{ provide: RondasService, useValue: service }],
    }).compile();

    controller = module.get<RondasController>(RondasController);
  });

  const rolesOf = (methodName: keyof RondasController): Role[] =>
    Reflect.getMetadata(ROLES_KEY, RondasController.prototype[methodName]) ??
    [];

  describe('ejecutar', () => {
    it('reads the access_token cookie and forwards it to the service', async () => {
      const ronda = { id: 1, estado: 'COMPLETADA' };
      service.ejecutar.mockResolvedValue(ronda);

      const result = await controller.ejecutar(requestWithToken('token-123'));

      expect(service.ejecutar).toHaveBeenCalledWith('token-123');
      expect(result).toBe(ronda);
    });

    it('is restricted to ADMINISTRADOR, matching the MS @PreAuthorize', () => {
      expect(rolesOf('ejecutar')).toEqual([Role.ADMINISTRADOR]);
    });
  });

  describe('listar', () => {
    it('reads the access_token cookie and forwards query params to the service', async () => {
      const page = { content: [], totalElements: 0 };
      service.listar.mockResolvedValue(page);

      const result = await controller.listar(
        requestWithToken('token-123'),
        '0',
        '20',
        'ejecutadaEn,desc',
      );

      expect(service.listar).toHaveBeenCalledWith(
        'token-123',
        '0',
        '20',
        'ejecutadaEn,desc',
      );
      expect(result).toBe(page);
    });

    it('is restricted to ADMINISTRADOR, matching the MS @PreAuthorize', () => {
      expect(rolesOf('listar')).toEqual([Role.ADMINISTRADOR]);
    });
  });

  describe('detalle', () => {
    it('reads the access_token cookie and forwards id to the service', async () => {
      const ronda = { id: 1, estado: 'COMPLETADA' };
      service.detalle.mockResolvedValue(ronda);

      const result = await controller.detalle(1, requestWithToken('token-123'));

      expect(service.detalle).toHaveBeenCalledWith(1, 'token-123');
      expect(result).toBe(ronda);
    });

    it('is restricted to ADMINISTRADOR, matching the MS @PreAuthorize', () => {
      expect(rolesOf('detalle')).toEqual([Role.ADMINISTRADOR]);
    });
  });

  describe('asignaciones', () => {
    it('reads the access_token cookie and forwards id to the service', async () => {
      const items = [{ donacionId: 7 }];
      service.asignaciones.mockResolvedValue(items);

      const result = await controller.asignaciones(
        4,
        requestWithToken('token-123'),
      );

      expect(service.asignaciones).toHaveBeenCalledWith(4, 'token-123');
      expect(result).toBe(items);
    });

    it('is restricted to ADMINISTRADOR, matching the MS @PreAuthorize', () => {
      expect(rolesOf('asignaciones')).toEqual([Role.ADMINISTRADOR]);
    });
  });

  describe('fondo', () => {
    it('reads the access_token cookie and forwards it to the service', async () => {
      const estado = { pendientes: 3, masAntiguaDesde: '2026-09-01' };
      service.fondo.mockResolvedValue(estado);

      const result = await controller.fondo(requestWithToken('token-123'));

      expect(service.fondo).toHaveBeenCalledWith('token-123');
      expect(result).toBe(estado);
    });

    it('is restricted to ADMINISTRADOR, matching the MS @PreAuthorize', () => {
      expect(rolesOf('fondo')).toEqual([Role.ADMINISTRADOR]);
    });
  });
});
