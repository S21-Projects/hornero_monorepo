import { Test, TestingModule } from '@nestjs/testing';
import type { Request } from 'express';
import { DonacionesController } from './donaciones.controller';
import { DonacionesService } from './donaciones.service';

describe('DonacionesController', () => {
  let controller: DonacionesController;
  let service: { findDeMiOrganizacion: jest.Mock };

  const requestWithToken = (token?: string) =>
    ({ cookies: token ? { access_token: token } : {} }) as unknown as Request;

  beforeEach(async () => {
    service = { findDeMiOrganizacion: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DonacionesController],
      providers: [{ provide: DonacionesService, useValue: service }],
    }).compile();

    controller = module.get<DonacionesController>(DonacionesController);
  });

  describe('findDeMiOrganizacion', () => {
    it('reads the access_token cookie and forwards it to the service', async () => {
      const donaciones = [{ id: 1, organizacionId: 10 }];
      service.findDeMiOrganizacion.mockResolvedValue(donaciones);

      const result = await controller.findDeMiOrganizacion(requestWithToken('token-123'));

      expect(service.findDeMiOrganizacion).toHaveBeenCalledWith('token-123');
      expect(result).toBe(donaciones);
    });

    it('throws UnauthorizedException when no access_token cookie is present', () => {
      expect(() => controller.findDeMiOrganizacion(requestWithToken())).toThrow(
        'No access token',
      );
    });
  });
});
