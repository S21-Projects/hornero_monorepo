import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { ROLES_KEY } from '../auth/decorators/roles.decorator.js';
import { Role } from '../common/enums/role.enum.js';
import { AuditoriaController } from './auditoria.controller';
import { AcreditacionService } from './acreditacion.service';

describe('AuditoriaController', () => {
  let controller: AuditoriaController;
  let service: { colaAuditoria: jest.Mock };

  const requestWithToken = (token = 'token-123') =>
    ({ cookies: { access_token: token } }) as unknown as Request;

  beforeEach(async () => {
    service = { colaAuditoria: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuditoriaController],
      providers: [{ provide: AcreditacionService, useValue: service }],
    }).compile();

    controller = module.get<AuditoriaController>(AuditoriaController);
  });

  const rolesOf = (methodName: keyof AuditoriaController): Role[] =>
    (Reflect.getMetadata(
      ROLES_KEY,
      AuditoriaController.prototype[methodName],
    ) as Role[] | undefined) ?? [];

  it('evidencias() is ADMINISTRADOR-only (AD-8)', () => {
    expect(rolesOf('evidencias')).toEqual([Role.ADMINISTRADOR]);
  });

  it('is not @Public — RolesGuard + JwtAuthGuard both apply', () => {
    expect(
      Reflect.getMetadata('isPublic', AuditoriaController),
    ).toBeUndefined();
  });

  it('throws UnauthorizedException when no access_token cookie is present', () => {
    const requestWithoutToken = { cookies: {} } as unknown as Request;
    expect(() =>
      controller.evidencias(
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        requestWithoutToken,
      ),
    ).toThrow(UnauthorizedException);
  });

  it('forwards every whitelisted query param and the token to colaAuditoria()', async () => {
    const response = { content: [], totalElements: 0 };
    service.colaAuditoria.mockResolvedValue(response);

    const result = await controller.evidencias(
      'VENCIDAS',
      'N2',
      'RADIO_50KM_BANCO_ALIMENTOS',
      'FOTO',
      '1',
      '10',
      'cargadoEn,desc',
      requestWithToken('token-123'),
    );

    expect(service.colaAuditoria).toHaveBeenCalledWith(
      {
        tab: 'VENCIDAS',
        nivel: 'N2',
        requisito: 'RADIO_50KM_BANCO_ALIMENTOS',
        tipoEvidencia: 'FOTO',
        page: '1',
        size: '10',
        sort: 'cargadoEn,desc',
      },
      'token-123',
    );
    expect(result).toBe(response);
  });

  it('forwards undefined filters when no query params are supplied', async () => {
    const response = { content: [], totalElements: 0 };
    service.colaAuditoria.mockResolvedValue(response);

    const result = await controller.evidencias(
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      requestWithToken('token-123'),
    );

    expect(service.colaAuditoria).toHaveBeenCalledWith(
      {
        tab: undefined,
        nivel: undefined,
        requisito: undefined,
        tipoEvidencia: undefined,
        page: undefined,
        size: undefined,
        sort: undefined,
      },
      'token-123',
    );
    expect(result).toBe(response);
  });
});
