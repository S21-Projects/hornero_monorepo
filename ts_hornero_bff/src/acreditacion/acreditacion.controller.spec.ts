import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import type { Request } from 'express';
import { ROLES_KEY } from '../auth/decorators/roles.decorator.js';
import { Role } from '../common/enums/role.enum.js';
import { AcreditacionController } from './acreditacion.controller';
import { AcreditacionService } from './acreditacion.service';
import { CargarEvidenciaDto } from './dto/cargar-evidencia.dto.js';
import { AuditarEvidenciaDto } from './dto/auditar-evidencia.dto.js';
import { CambiarNivelDto } from './dto/cambiar-nivel.dto';

describe('AcreditacionController', () => {
  let controller: AcreditacionController;
  let service: {
    acreditacion: jest.Mock;
    cargarEvidencia: jest.Mock;
    aprobarEvidencia: jest.Mock;
    observarEvidencia: jest.Mock;
    cambiarNivel: jest.Mock;
    legajo: jest.Mock;
    evidencias: jest.Mock;
  };

  const requestWithToken = (token = 'token-123') =>
    ({ cookies: { access_token: token } }) as unknown as Request;

  beforeEach(async () => {
    service = {
      acreditacion: jest.fn(),
      cargarEvidencia: jest.fn(),
      aprobarEvidencia: jest.fn(),
      observarEvidencia: jest.fn(),
      cambiarNivel: jest.fn(),
      legajo: jest.fn(),
      evidencias: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AcreditacionController],
      providers: [{ provide: AcreditacionService, useValue: service }],
    }).compile();

    controller = module.get<AcreditacionController>(AcreditacionController);
  });

  const rolesOf = (methodName: keyof AcreditacionController): Role[] =>
    (Reflect.getMetadata(
      ROLES_KEY,
      AcreditacionController.prototype[methodName],
    ) as Role[] | undefined) ?? [];

  describe('role matrix — matches the MS @PreAuthorize table', () => {
    it('acreditacion() admits ADMINISTRADOR and REFERENTE', () => {
      expect(rolesOf('acreditacion')).toEqual([
        Role.ADMINISTRADOR,
        Role.REFERENTE,
      ]);
    });

    it('cargarEvidencia() is REFERENTE-only', () => {
      expect(rolesOf('cargarEvidencia')).toEqual([Role.REFERENTE]);
    });

    it('aprobarEvidencia() is ADMINISTRADOR-only', () => {
      expect(rolesOf('aprobarEvidencia')).toEqual([Role.ADMINISTRADOR]);
    });

    it('observarEvidencia() is ADMINISTRADOR-only', () => {
      expect(rolesOf('observarEvidencia')).toEqual([Role.ADMINISTRADOR]);
    });

    it('cambiarNivel() is ADMINISTRADOR-only', () => {
      expect(rolesOf('cambiarNivel')).toEqual([Role.ADMINISTRADOR]);
    });

    it('legajo() admits ADMINISTRADOR and REFERENTE (D-01)', () => {
      expect(rolesOf('legajo')).toEqual([Role.ADMINISTRADOR, Role.REFERENTE]);
    });

    it('evidencias() is ADMINISTRADOR-only (D-02, narrower than D-01)', () => {
      expect(rolesOf('evidencias')).toEqual([Role.ADMINISTRADOR]);
    });

    it('none of the six routes are @Public — RolesGuard + JwtAuthGuard both apply', () => {
      expect(
        Reflect.getMetadata('isPublic', AcreditacionController),
      ).toBeUndefined();
    });
  });

  describe('cookie -> Bearer forwarding', () => {
    it('reads the access_token cookie and forwards id + token to acreditacion()', async () => {
      const response = { organizacionId: 1, nivel: 'N1' };
      service.acreditacion.mockResolvedValue(response);

      const result = await controller.acreditacion(
        1,
        requestWithToken('token-123'),
      );

      expect(service.acreditacion).toHaveBeenCalledWith(1, 'token-123');
      expect(result).toBe(response);
    });

    it('throws UnauthorizedException when no access_token cookie is present', () => {
      const requestWithoutToken = { cookies: {} } as unknown as Request;
      expect(() => controller.acreditacion(1, requestWithoutToken)).toThrow(
        UnauthorizedException,
      );
    });

    it('forwards id + dto + token to cargarEvidencia()', async () => {
      const dto = {
        requisito: 'NO_DISCRIMINACION',
        tipoEvidencia: 'DECLARACION',
      } satisfies CargarEvidenciaDto;
      const response = { id: 10 };
      service.cargarEvidencia.mockResolvedValue(response);

      const result = await controller.cargarEvidencia(
        1,
        dto,
        requestWithToken('token-123'),
      );

      expect(service.cargarEvidencia).toHaveBeenCalledWith(1, dto, 'token-123');
      expect(result).toBe(response);
    });

    it('forwards id + evId + token to aprobarEvidencia()', async () => {
      const response = { id: 10, estado: 'APROBADA' };
      service.aprobarEvidencia.mockResolvedValue(response);

      const result = await controller.aprobarEvidencia(
        1,
        10,
        requestWithToken('token-123'),
      );

      expect(service.aprobarEvidencia).toHaveBeenCalledWith(1, 10, 'token-123');
      expect(result).toBe(response);
    });

    it('forwards id + evId + dto + token to observarEvidencia()', async () => {
      const dto = { observacion: 'falta firma' } satisfies AuditarEvidenciaDto;
      const response = { id: 10, estado: 'OBSERVADA' };
      service.observarEvidencia.mockResolvedValue(response);

      const result = await controller.observarEvidencia(
        1,
        10,
        dto,
        requestWithToken('token-123'),
      );

      expect(service.observarEvidencia).toHaveBeenCalledWith(
        1,
        10,
        dto,
        'token-123',
      );
      expect(result).toBe(response);
    });

    it('forwards id + dto + token to cambiarNivel()', async () => {
      const dto = {
        destino: 'N1',
        motivo: 'cumple requisitos',
      } satisfies CambiarNivelDto;
      const response = { organizacionId: 1, nivel: 'N1' };
      service.cambiarNivel.mockResolvedValue(response);

      const result = await controller.cambiarNivel(
        1,
        dto,
        requestWithToken('token-123'),
      );

      expect(service.cambiarNivel).toHaveBeenCalledWith(1, dto, 'token-123');
      expect(result).toBe(response);
    });

    it('forwards id + token to legajo()', async () => {
      const response = { organizacionId: 1 };
      service.legajo.mockResolvedValue(response);

      const result = await controller.legajo(1, requestWithToken('token-123'));

      expect(service.legajo).toHaveBeenCalledWith(1, 'token-123');
      expect(result).toBe(response);
    });

    it('forwards id + estado + token to evidencias()', async () => {
      const response = [{ id: 10, estado: 'PENDIENTE' }];
      service.evidencias.mockResolvedValue(response);

      const result = await controller.evidencias(
        1,
        'PENDIENTE',
        requestWithToken('token-123'),
      );

      expect(service.evidencias).toHaveBeenCalledWith(
        1,
        'PENDIENTE',
        'token-123',
      );
      expect(result).toBe(response);
    });

    it('forwards undefined estado to evidencias() when no filter is supplied', async () => {
      const response: unknown[] = [];
      service.evidencias.mockResolvedValue(response);

      const result = await controller.evidencias(
        1,
        undefined,
        requestWithToken('token-123'),
      );

      expect(service.evidencias).toHaveBeenCalledWith(
        1,
        undefined,
        'token-123',
      );
      expect(result).toBe(response);
    });
  });

  describe('CambiarNivelDto validation', () => {
    it('rejects a blank motivo', async () => {
      const dto = plainToInstance(CambiarNivelDto, {
        destino: 'N1',
        motivo: '',
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.property === 'motivo')).toBe(true);
    });

    it('rejects an unknown destino', async () => {
      const dto = plainToInstance(CambiarNivelDto, {
        destino: 'N99',
        motivo: 'cumple requisitos',
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.property === 'destino')).toBe(true);
    });

    it('accepts a valid destino and motivo', async () => {
      const dto = plainToInstance(CambiarNivelDto, {
        destino: 'N1',
        motivo: 'cumple requisitos',
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });
  });
});
