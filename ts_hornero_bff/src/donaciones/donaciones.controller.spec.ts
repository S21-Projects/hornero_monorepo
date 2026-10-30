import { HTTP_CODE_METADATA } from '@nestjs/common/constants';
import { Test, TestingModule } from '@nestjs/testing';
import type { Request } from 'express';
import { ROLES_KEY } from '../auth/decorators/roles.decorator.js';
import { Role } from '../common/enums/role.enum.js';
import { DonacionesController } from './donaciones.controller';
import { DonacionesService } from './donaciones.service';

describe('DonacionesController', () => {
  let controller: DonacionesController;
  let service: {
    findDeMiOrganizacion: jest.Mock;
    findById: jest.Mock;
    getDonaciones: jest.Mock;
    decidir: jest.Mock;
    actualizarEstado: jest.Mock;
    overrideEstado: jest.Mock;
    findActivas: jest.Mock;
    generarCodigoEntrega: jest.Mock;
    verificarCodigoEntrega: jest.Mock;
    estadoEntrega: jest.Mock;
    asignaciones: jest.Mock;
  };

  const requestWithToken = (token?: string) =>
    ({ cookies: token ? { access_token: token } : {} }) as unknown as Request;

  beforeEach(async () => {
    service = {
      findDeMiOrganizacion: jest.fn(),
      findById: jest.fn(),
      getDonaciones: jest.fn(),
      decidir: jest.fn(),
      actualizarEstado: jest.fn(),
      overrideEstado: jest.fn(),
      findActivas: jest.fn(),
      generarCodigoEntrega: jest.fn(),
      verificarCodigoEntrega: jest.fn(),
      estadoEntrega: jest.fn(),
      asignaciones: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DonacionesController],
      providers: [{ provide: DonacionesService, useValue: service }],
    }).compile();

    controller = module.get<DonacionesController>(DonacionesController);
  });

  const rolesOf = (methodName: keyof DonacionesController): Role[] =>
    Reflect.getMetadata(
      ROLES_KEY,
      DonacionesController.prototype[methodName],
    ) ?? [];

  describe('public reads with optional session', () => {
    it('findById forwards the cookie token when present', async () => {
      await controller.findById(5, requestWithToken('token-123'));
      expect(service.findById).toHaveBeenCalledWith(5, 'token-123');
    });

    it('findById passes undefined (no 401) when anonymous', async () => {
      await controller.findById(5, requestWithToken());
      expect(service.findById).toHaveBeenCalledWith(5, undefined);
    });

    it('getDonaciones forwards the cookie token when present', async () => {
      await controller.getDonaciones(
        requestWithToken('tk'),
        '10',
        '0',
        '20',
        'id,desc',
      );
      expect(service.getDonaciones).toHaveBeenCalledWith(
        '10',
        '0',
        '20',
        'id,desc',
        'tk',
      );
    });

    it('getDonaciones passes undefined when anonymous', async () => {
      await controller.getDonaciones(requestWithToken(), '10');
      expect(service.getDonaciones).toHaveBeenCalledWith(
        '10',
        undefined,
        undefined,
        undefined,
        undefined,
      );
    });
  });

  describe('findDeMiOrganizacion', () => {
    it('reads the access_token cookie and forwards it to the service', async () => {
      const donaciones = [{ id: 1, organizacionId: 10 }];
      service.findDeMiOrganizacion.mockResolvedValue(donaciones);

      const result = await controller.findDeMiOrganizacion(
        requestWithToken('token-123'),
      );

      expect(service.findDeMiOrganizacion).toHaveBeenCalledWith(
        'token-123',
        undefined,
        undefined,
        undefined,
        undefined,
      );
      expect(result).toBe(donaciones);
    });

    it('forwards an optional organizacionId query param to the service', async () => {
      const donaciones = [{ id: 1, organizacionId: 10 }];
      service.findDeMiOrganizacion.mockResolvedValue(donaciones);

      await controller.findDeMiOrganizacion(
        requestWithToken('token-123'),
        '10',
      );

      expect(service.findDeMiOrganizacion).toHaveBeenCalledWith(
        'token-123',
        '10',
        undefined,
        undefined,
        undefined,
      );
    });

    it('forwards page, size and sort to the service', async () => {
      service.findDeMiOrganizacion.mockResolvedValue({ content: [] });

      await controller.findDeMiOrganizacion(
        requestWithToken('token-123'),
        '10',
        '2',
        '20',
        'fechaOferta,desc',
      );

      expect(service.findDeMiOrganizacion).toHaveBeenCalledWith(
        'token-123',
        '10',
        '2',
        '20',
        'fechaOferta,desc',
      );
    });

    it('throws UnauthorizedException when no access_token cookie is present', () => {
      expect(() => controller.findDeMiOrganizacion(requestWithToken())).toThrow(
        'No access token',
      );
    });
  });

  describe('decidir', () => {
    it('reads the access_token cookie and forwards id + dto to the service', async () => {
      const donacion = { id: 1, estado: 'ACEPTADA' };
      service.decidir.mockResolvedValue(donacion);
      const dto = { estado: 'ACEPTADA' };

      const result = await controller.decidir(
        1,
        dto,
        requestWithToken('token-123'),
      );

      expect(service.decidir).toHaveBeenCalledWith(1, dto, 'token-123');
      expect(result).toBe(donacion);
    });

    it('is restricted to REFERENTE, matching the MS @PreAuthorize', () => {
      expect(rolesOf('decidir')).toEqual([Role.REFERENTE]);
    });
  });

  describe('actualizarEstado', () => {
    it('is restricted to DONANTE, matching the MS @PreAuthorize flip', () => {
      expect(rolesOf('actualizarEstado')).toEqual([Role.DONANTE]);
    });
  });

  describe('overrideEstado', () => {
    it('reads the access_token cookie and forwards id + dto to the service', async () => {
      const donacion = { id: 1, estado: 'CANCELADA' };
      service.overrideEstado.mockResolvedValue(donacion);
      const dto = { estado: 'CANCELADA', motivo: 'Duplicada' };

      const result = await controller.overrideEstado(
        1,
        dto,
        requestWithToken('token-123'),
      );

      expect(service.overrideEstado).toHaveBeenCalledWith(1, dto, 'token-123');
      expect(result).toBe(donacion);
    });

    it('is restricted to ADMINISTRADOR, matching the MS @PreAuthorize', () => {
      expect(rolesOf('overrideEstado')).toEqual([Role.ADMINISTRADOR]);
    });
  });

  describe('generarCodigoEntrega', () => {
    it('reads the access_token cookie and forwards id to the service', async () => {
      const codigo = { codigo: '482913', expiraEn: '2026-09-30T12:10:00Z' };
      service.generarCodigoEntrega.mockResolvedValue(codigo);

      const result = await controller.generarCodigoEntrega(
        1,
        requestWithToken('token-123'),
      );

      expect(service.generarCodigoEntrega).toHaveBeenCalledWith(1, 'token-123');
      expect(result).toBe(codigo);
    });

    it('is restricted to DONANTE and REFERENTE, matching the MS @PreAuthorize', () => {
      expect(rolesOf('generarCodigoEntrega')).toEqual([
        Role.DONANTE,
        Role.REFERENTE,
      ]);
    });
  });

  describe('verificarCodigoEntrega', () => {
    it('answers 200, not the POST default 201: verifying creates nothing', () => {
      const status = Reflect.getMetadata(
        HTTP_CODE_METADATA,
        DonacionesController.prototype.verificarCodigoEntrega,
      ) as number | undefined;
      expect(status).toBe(200);
    });

    it('reads the access_token cookie and forwards id + dto to the service', async () => {
      const estado = {
        estado: 'PENDIENTE_CONFIRMACION',
        confirmadaDonanteEn: null,
        confirmadaReferenteEn: '2026-09-30T12:00:00Z',
      };
      service.verificarCodigoEntrega.mockResolvedValue(estado);
      const dto = { codigo: '482913' };

      const result = await controller.verificarCodigoEntrega(
        1,
        dto,
        requestWithToken('token-123'),
      );

      expect(service.verificarCodigoEntrega).toHaveBeenCalledWith(
        1,
        dto,
        'token-123',
      );
      expect(result).toBe(estado);
    });

    it('is restricted to DONANTE and REFERENTE, matching the MS @PreAuthorize', () => {
      expect(rolesOf('verificarCodigoEntrega')).toEqual([
        Role.DONANTE,
        Role.REFERENTE,
      ]);
    });
  });

  describe('estadoEntrega', () => {
    it('reads the access_token cookie and forwards id to the service', async () => {
      const estado = {
        estado: 'EN_CAMINO',
        confirmadaDonanteEn: null,
        confirmadaReferenteEn: null,
      };
      service.estadoEntrega.mockResolvedValue(estado);

      const result = await controller.estadoEntrega(
        1,
        requestWithToken('token-123'),
      );

      expect(service.estadoEntrega).toHaveBeenCalledWith(1, 'token-123');
      expect(result).toBe(estado);
    });

    it('is restricted to DONANTE and REFERENTE, matching the MS @PreAuthorize', () => {
      expect(rolesOf('estadoEntrega')).toEqual([Role.DONANTE, Role.REFERENTE]);
    });
  });

  describe('findActivas', () => {
    it('reads the access_token cookie and forwards query params to the service', async () => {
      const page = { content: [], totalElements: 0 };
      service.findActivas.mockResolvedValue(page);

      const result = await controller.findActivas(
        requestWithToken('token-123'),
        '0',
        '20',
        'fechaOferta,desc',
        'org',
        'OFRECIDA',
      );

      expect(service.findActivas).toHaveBeenCalledWith(
        'token-123',
        '0',
        '20',
        'fechaOferta,desc',
        'org',
        'OFRECIDA',
        undefined,
      );
      expect(result).toBe(page);
    });

    it('forwards the estancadas filter as the last argument (N12)', async () => {
      service.findActivas.mockResolvedValue({ content: [] });

      await controller.findActivas(
        requestWithToken('token-123'),
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        'true',
      );

      expect(service.findActivas).toHaveBeenCalledWith(
        'token-123',
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        'true',
      );
    });

    it('is restricted to ADMINISTRADOR, matching the MS @PreAuthorize', () => {
      expect(rolesOf('findActivas')).toEqual([Role.ADMINISTRADOR]);
    });
  });

  describe('asignaciones', () => {
    it('reads the access_token cookie and forwards id to the service', async () => {
      const historial = [{ id: 1, estado: 'PROPUESTA' }];
      service.asignaciones.mockResolvedValue(historial);

      const result = await controller.asignaciones(
        1,
        requestWithToken('token-123'),
      );

      expect(service.asignaciones).toHaveBeenCalledWith(1, 'token-123');
      expect(result).toBe(historial);
    });

    it('is restricted to DONANTE, REFERENTE and ADMINISTRADOR, matching the MS @PreAuthorize', () => {
      expect(rolesOf('asignaciones')).toEqual([
        Role.DONANTE,
        Role.REFERENTE,
        Role.ADMINISTRADOR,
      ]);
    });
  });
});
