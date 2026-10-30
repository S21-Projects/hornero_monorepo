import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { ROLES_KEY } from '../auth/decorators/roles.decorator.js';
import { Role } from '../common/enums/role.enum.js';
import { UsuariosController } from './usuarios.controller';
import { UsuariosService } from './usuarios.service';

describe('UsuariosController', () => {
  let controller: UsuariosController;
  let service: {
    findAll: jest.Mock;
    toggleActivo: jest.Mock;
    anonimizar: jest.Mock;
  };

  const requestWithToken = (token?: string) =>
    ({ cookies: token ? { access_token: token } : {} }) as unknown as Request;

  beforeEach(async () => {
    service = {
      findAll: jest.fn(),
      toggleActivo: jest.fn(),
      anonimizar: jest.fn(),
    };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsuariosController],
      providers: [{ provide: UsuariosService, useValue: service }],
    }).compile();
    controller = module.get(UsuariosController);
  });

  const rolesOf = (name: keyof UsuariosController): Role[] =>
    Reflect.getMetadata(ROLES_KEY, UsuariosController.prototype[name]) ?? [];

  describe('anonimizar (N15)', () => {
    it('is restricted to ADMINISTRADOR', () => {
      expect(rolesOf('anonimizar')).toEqual([Role.ADMINISTRADOR]);
    });

    it('forwards the id with the cookie token', async () => {
      service.anonimizar.mockResolvedValue({ id: 7 });

      const res = await controller.anonimizar(7, requestWithToken('tok'));

      expect(service.anonimizar).toHaveBeenCalledWith(7, 'tok');
      expect(res).toEqual({ id: 7 });
    });

    it('rejects a request without access_token', () => {
      expect(() => controller.anonimizar(7, requestWithToken())).toThrow(
        UnauthorizedException,
      );
      expect(service.anonimizar).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('is restricted to ADMINISTRADOR', () => {
      expect(rolesOf('findAll')).toEqual([Role.ADMINISTRADOR]);
    });

    it('forwards the filters and paging with the cookie token', async () => {
      service.findAll.mockResolvedValue({ content: [] });

      const res = await controller.findAll(
        requestWithToken('tok'),
        'REFERENTE',
        'true',
        'ana',
        '1',
        '20',
        'id,asc',
      );

      expect(service.findAll).toHaveBeenCalledWith('tok', {
        tipo: 'REFERENTE',
        activo: 'true',
        q: 'ana',
        page: '1',
        size: '20',
        sort: 'id,asc',
      });
      expect(res).toEqual({ content: [] });
    });

    it('rejects a request without access_token', () => {
      expect(() => controller.findAll(requestWithToken())).toThrow(
        UnauthorizedException,
      );
    });
  });
});
