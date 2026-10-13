import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import type { Request } from 'express';
import { ROLES_KEY } from '../auth/decorators/roles.decorator.js';
import { Role } from '../common/enums/role.enum.js';
import { ReclamosController } from './reclamos.controller';
import { ReclamosService } from './reclamos.service';
import { CrearReclamoDto } from './dto/crear-reclamo.dto.js';
import { RechazarReclamoDto } from './dto/rechazar-reclamo.dto.js';

describe('ReclamosController', () => {
  let controller: ReclamosController;
  let service: Record<
    'crear' | 'mios' | 'pendientes' | 'detalle' | 'aprobar' | 'rechazar',
    jest.Mock
  >;

  const req = (token = 'token-123') =>
    ({ cookies: { access_token: token } }) as unknown as Request;

  beforeEach(async () => {
    service = {
      crear: jest.fn().mockResolvedValue({ id: 1 }),
      mios: jest.fn().mockResolvedValue([]),
      pendientes: jest.fn().mockResolvedValue({ content: [] }),
      detalle: jest.fn().mockResolvedValue({ id: 1 }),
      aprobar: jest.fn().mockResolvedValue({ id: 1 }),
      rechazar: jest.fn().mockResolvedValue({ id: 1 }),
    };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReclamosController],
      providers: [{ provide: ReclamosService, useValue: service }],
    }).compile();
    controller = module.get(ReclamosController);
  });

  const rolesOf = (method: keyof ReclamosController): Role[] =>
    Reflect.getMetadata(
      ROLES_KEY,
      ReclamosController.prototype[method],
    ) as Role[];

  it('pins the role matrix (kept in sync with the MS @PreAuthorize)', () => {
    expect(rolesOf('crear')).toEqual([Role.REFERENTE]);
    expect(rolesOf('mios')).toEqual([Role.REFERENTE]);
    expect(rolesOf('pendientes')).toEqual([Role.ADMINISTRADOR]);
    expect(rolesOf('detalle')).toEqual([Role.ADMINISTRADOR, Role.REFERENTE]);
    expect(rolesOf('aprobar')).toEqual([Role.ADMINISTRADOR]);
    expect(rolesOf('rechazar')).toEqual([Role.ADMINISTRADOR]);
  });

  it('forwards the cookie token to the service', async () => {
    const dto = { organizacionId: 1 } as CrearReclamoDto;
    await controller.crear(dto, req('t'));
    await controller.mios(req('t'));
    await controller.pendientes(req('t'), '0', '10', undefined);
    await controller.detalle(3, req('t'));
    await controller.aprobar(3, req('t'));
    await controller.rechazar(3, { motivo: 'x' }, req('t'));

    expect(service.crear).toHaveBeenCalledWith(dto, 't');
    expect(service.mios).toHaveBeenCalledWith('t');
    expect(service.pendientes).toHaveBeenCalledWith('t', '0', '10', undefined);
    expect(service.detalle).toHaveBeenCalledWith(3, 't');
    expect(service.aprobar).toHaveBeenCalledWith(3, 't');
    expect(service.rechazar).toHaveBeenCalledWith(3, { motivo: 'x' }, 't');
  });

  it('rejects a request without the access_token cookie', () => {
    const anon = { cookies: {} } as unknown as Request;
    expect(() => controller.mios(anon)).toThrow(UnauthorizedException);
    expect(service.mios).not.toHaveBeenCalled();
  });

  describe('CrearReclamoDto', () => {
    const valid = {
      organizacionId: 4,
      rol: 'VOLUNTARIO',
      telefono: '+54 351 555-1234',
      mensaje: 'Hola',
      evidenciaKeys: ['reclamo-evidencia/4/7/1.jpg'],
    };
    const errorsFor = async (patch: Record<string, unknown>) =>
      (
        await validate(plainToInstance(CrearReclamoDto, { ...valid, ...patch }))
      ).map((e) => e.property);

    it('accepts a valid body (mensaje optional)', async () => {
      expect(await errorsFor({})).toEqual([]);
      expect(await errorsFor({ mensaje: undefined })).toEqual([]);
    });

    it.each([
      ['rol', { rol: 'DUENIO' }],
      ['telefono', { telefono: 'abc' }],
      ['organizacionId', { organizacionId: 'x' }],
      ['evidenciaKeys', { evidenciaKeys: [] }],
      ['evidenciaKeys', { evidenciaKeys: ['a', 'b', 'c', 'd'] }],
      ['mensaje', { mensaje: 'x'.repeat(1001) }],
    ])('rejects an invalid %s', async (property, patch) => {
      expect(await errorsFor(patch)).toContain(property);
    });
  });

  describe('RechazarReclamoDto', () => {
    it('requires a non-empty motivo', async () => {
      for (const motivo of [undefined, '']) {
        const errors = await validate(
          plainToInstance(RechazarReclamoDto, { motivo }),
        );
        expect(errors.map((e) => e.property)).toContain('motivo');
      }
      expect(
        await validate(plainToInstance(RechazarReclamoDto, { motivo: 'ok' })),
      ).toHaveLength(0);
    });
  });
});
