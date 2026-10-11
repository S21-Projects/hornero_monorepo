import { UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { ROLES_KEY } from '../auth/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { ActividadController } from './actividad.controller';

describe('ActividadController', () => {
  const service = { listar: jest.fn() };
  const controller = new ActividadController(service as any);
  const req = (token?: string) =>
    ({ cookies: token ? { access_token: token } : {} }) as unknown as Request;

  beforeEach(() => service.listar.mockReset());

  it('is restricted to ADMINISTRADOR, matching the MS', () => {
    expect(
      Reflect.getMetadata(ROLES_KEY, ActividadController.prototype.listar),
    ).toEqual([Role.ADMINISTRADOR]);
  });

  it('forwards the cookie token and the filters', async () => {
    service.listar.mockResolvedValue({ content: [] });
    const query = { accion: 'LOGIN', resultado: 'FALLO', page: '0' };

    const out = await controller.listar(req('tok'), query);

    expect(service.listar).toHaveBeenCalledWith('tok', query);
    expect(out).toEqual({ content: [] });
  });

  it('rejects a request without an access token cookie', () => {
    expect(() => controller.listar(req(), {})).toThrow(UnauthorizedException);
  });

  it('exposes read access only', () => {
    const methods = Object.getOwnPropertyNames(
      ActividadController.prototype,
    ).filter((m) => m !== 'constructor' && !m.startsWith('get'));
    expect(methods).toEqual(['listar']);
  });
});
