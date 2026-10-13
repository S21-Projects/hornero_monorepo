import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { NecesidadesService } from './necesidades.service';

const MS_URL = 'http://localhost:8081';

describe('NecesidadesService — buildQuery forwarding', () => {
  let service: NecesidadesService;
  let getMock: jest.Mock;
  let postMock: jest.Mock;

  beforeEach(async () => {
    postMock = jest
      .fn()
      .mockResolvedValue({ data: { id: 7, estado: 'ABIERTA' } });
    getMock = jest.fn().mockResolvedValue({ data: { status: 200, data: [] } });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NecesidadesService,
        {
          provide: HttpService,
          useValue: { axiosRef: { get: getMock, post: postMock } },
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
      { headers: {} },
    );
  });

  it('includes organizacionId alongside pagination params', async () => {
    await service.getNecesidades('3', '2', '10', 'id,asc');
    expect(getMock).toHaveBeenCalledWith(
      `${MS_URL}/api/necesidades?organizacionId=3&page=2&size=10&sort=id%2Casc`,
      { headers: {} },
    );
  });

  it('produces a plain URL with no query string when all params are absent', async () => {
    await service.getNecesidades(undefined, undefined, undefined, undefined);
    expect(getMock).toHaveBeenCalledWith(`${MS_URL}/api/necesidades`, {
      headers: {},
    });
  });

  it('forwards the session token on the public listing so the MS can show a referente its own expired needs', async () => {
    await service.getNecesidades('3', undefined, undefined, undefined, 'tok');
    expect(getMock).toHaveBeenCalledWith(
      `${MS_URL}/api/necesidades?organizacionId=3`,
      {
        headers: { Authorization: 'Bearer tok' },
      },
    );
  });

  it('findById forwards the session token so the MS can show an N0 necesidad to its owner (N17)', async () => {
    await service.findById(7, 'tok');
    expect(getMock).toHaveBeenCalledWith(`${MS_URL}/api/necesidades/7`, {
      headers: { Authorization: 'Bearer tok' },
    });
  });

  it('findById sends no Authorization header for anonymous callers', async () => {
    await service.findById(7);
    expect(getMock).toHaveBeenCalledWith(`${MS_URL}/api/necesidades/7`, {
      headers: {},
    });
  });

  it('relanzar POSTs the new date to the MS with the bearer token', async () => {
    const out = await service.relanzar(
      7,
      { fechaVencimiento: '2026-12-01' },
      'tok',
    );
    expect(postMock).toHaveBeenCalledWith(
      `${MS_URL}/api/necesidades/7/relanzar`,
      { fechaVencimiento: '2026-12-01' },
      { headers: { Authorization: 'Bearer tok' } },
    );
    expect(out).toEqual({ id: 7, estado: 'ABIERTA' });
  });
});
