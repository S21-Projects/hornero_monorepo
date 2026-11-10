import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import type { Request } from 'express';
import { ROLES_KEY } from '../auth/decorators/roles.decorator.js';
import { Role } from '../common/enums/role.enum.js';
import { ReportesController } from './reportes.controller';
import { ReportesService } from './reportes.service';
import { CrearReporteDto } from './dto/crear-reporte.dto.js';
import { DescartarReporteDto } from './dto/descartar-reporte.dto.js';

describe('ReportesController', () => {
  let controller: ReportesController;
  let service: Record<
    | 'crear'
    | 'cercanas'
    | 'pendientes'
    | 'detalle'
    | 'marcarInactiva'
    | 'descartar',
    jest.Mock
  >;

  const req = (token = 'token-123') =>
    ({ cookies: { access_token: token } }) as unknown as Request;

  beforeEach(async () => {
    service = {
      crear: jest.fn().mockResolvedValue({ id: 1 }),
      cercanas: jest.fn().mockResolvedValue([]),
      pendientes: jest.fn().mockResolvedValue({ content: [] }),
      detalle: jest.fn().mockResolvedValue({ id: 1 }),
      marcarInactiva: jest.fn().mockResolvedValue({ id: 1 }),
      descartar: jest.fn().mockResolvedValue({ id: 1 }),
    };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReportesController],
      providers: [{ provide: ReportesService, useValue: service }],
    }).compile();
    controller = module.get(ReportesController);
  });

  const rolesOf = (method: keyof ReportesController): Role[] | undefined =>
    Reflect.getMetadata(ROLES_KEY, ReportesController.prototype[method]) as
      | Role[]
      | undefined;

  it('pins the role matrix (kept in sync with the MS @PreAuthorize)', () => {
    // No @Roles = any authenticated session (the MS uses isAuthenticated()).
    expect(rolesOf('crear')).toBeUndefined();
    expect(rolesOf('cercanas')).toBeUndefined();
    expect(rolesOf('pendientes')).toEqual([Role.ADMINISTRADOR]);
    expect(rolesOf('detalle')).toEqual([Role.ADMINISTRADOR]);
    expect(rolesOf('marcarInactiva')).toEqual([Role.ADMINISTRADOR]);
    expect(rolesOf('descartar')).toEqual([Role.ADMINISTRADOR]);
  });

  it('forwards the cookie token to the service', async () => {
    const dto = { organizacionId: 1 } as CrearReporteDto;
    await controller.crear(dto, req('t'));
    await controller.cercanas(4, req('t'));
    await controller.pendientes(req('t'), '0', '10', undefined);
    await controller.detalle(3, req('t'));
    await controller.marcarInactiva(3, req('t'));
    await controller.descartar(3, { nota: 'x' }, req('t'));

    expect(service.crear).toHaveBeenCalledWith(dto, 't');
    expect(service.cercanas).toHaveBeenCalledWith(4, 't');
    expect(service.pendientes).toHaveBeenCalledWith('t', '0', '10', undefined);
    expect(service.detalle).toHaveBeenCalledWith(3, 't');
    expect(service.marcarInactiva).toHaveBeenCalledWith(3, 't');
    expect(service.descartar).toHaveBeenCalledWith(3, { nota: 'x' }, 't');
  });

  it('rejects a request without the access_token cookie', () => {
    const anon = { cookies: {} } as unknown as Request;
    expect(() => controller.cercanas(1, anon)).toThrow(UnauthorizedException);
    expect(service.cercanas).not.toHaveBeenCalled();
  });

  describe('CrearReporteDto', () => {
    const valid = {
      organizacionId: 4,
      motivo: 'DUPLICADO',
      organizacionDuplicadaId: 9,
      detalle: 'Es el mismo',
    };
    const errorsFor = async (patch: Record<string, unknown>) =>
      (
        await validate(plainToInstance(CrearReporteDto, { ...valid, ...patch }))
      ).map((e) => e.property);

    it('accepts a valid body (duplicate and detalle optional)', async () => {
      expect(await errorsFor({})).toEqual([]);
      expect(
        await errorsFor({
          motivo: 'INACTIVO',
          organizacionDuplicadaId: undefined,
          detalle: undefined,
        }),
      ).toEqual([]);
    });

    it.each([
      ['motivo', { motivo: 'ROBO' }],
      ['organizacionId', { organizacionId: 'x' }],
      ['organizacionDuplicadaId', { organizacionDuplicadaId: 0 }],
      ['detalle', { detalle: 'x'.repeat(1001) }],
    ])('rejects an invalid %s', async (property, patch) => {
      expect(await errorsFor(patch)).toContain(property);
    });
  });

  describe('DescartarReporteDto', () => {
    it('requires a non-empty nota', async () => {
      for (const nota of [undefined, '']) {
        const errors = await validate(
          plainToInstance(DescartarReporteDto, { nota }),
        );
        expect(errors.map((e) => e.property)).toContain('nota');
      }
      expect(
        await validate(plainToInstance(DescartarReporteDto, { nota: 'ok' })),
      ).toHaveLength(0);
    });
  });
});
