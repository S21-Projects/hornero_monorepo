import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { DonacionesService } from './donaciones.service';

describe('DonacionesService', () => {
  let service: DonacionesService;
  let httpService: { axiosRef: { get: jest.Mock } };
  let configService: { get: jest.Mock };

  beforeEach(async () => {
    httpService = { axiosRef: { get: jest.fn() } };
    configService = { get: jest.fn().mockReturnValue('http://ms:8081') };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DonacionesService,
        { provide: HttpService, useValue: httpService },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get<DonacionesService>(DonacionesService);
  });

  describe('findDeMiOrganizacion', () => {
    it('forwards the access token as a Bearer header to the MS mi-organizacion endpoint', async () => {
      const data = [{ id: 1, organizacionId: 10, estado: 'OFRECIDA' }];
      httpService.axiosRef.get.mockResolvedValue({ data });

      const result = await service.findDeMiOrganizacion('token-123');

      expect(httpService.axiosRef.get).toHaveBeenCalledWith(
        'http://ms:8081/api/donaciones/mi-organizacion',
        { headers: { Authorization: 'Bearer token-123' } },
      );
      expect(result).toEqual(data);
    });
  });
});
