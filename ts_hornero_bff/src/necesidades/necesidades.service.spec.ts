import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { NecesidadesService } from './necesidades.service';

const MS_URL = 'http://localhost:8081';

describe('NecesidadesService — buildQuery forwarding', () => {
  let service: NecesidadesService;
  let getMock: jest.Mock;

  beforeEach(async () => {
    getMock = jest.fn().mockResolvedValue({ data: { status: 200, data: [] } });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NecesidadesService,
        {
          provide: HttpService,
          useValue: { axiosRef: { get: getMock } },
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue(MS_URL) },
        },
      ],
    }).compile();

    service = module.get<NecesidadesService>(NecesidadesService);
  });

  it('forwards page, size, and sort with URLSearchParams encoding to the MS URL', async () => {
    await service.getNecesidades(undefined, '2', '10', 'id,asc');
    expect(getMock).toHaveBeenCalledWith(
      `${MS_URL}/api/necesidades?page=2&size=10&sort=id%2Casc`,
    );
  });

  it('includes organizacionId alongside pagination params', async () => {
    await service.getNecesidades('3', '2', '10', 'id,asc');
    expect(getMock).toHaveBeenCalledWith(
      `${MS_URL}/api/necesidades?organizacionId=3&page=2&size=10&sort=id%2Casc`,
    );
  });

  it('produces a plain URL with no query string when all params are absent', async () => {
    await service.getNecesidades(undefined, undefined, undefined, undefined);
    expect(getMock).toHaveBeenCalledWith(`${MS_URL}/api/necesidades`);
  });
});
