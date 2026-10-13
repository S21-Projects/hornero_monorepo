import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { ReportesService } from './reportes.service';

const MS_URL = 'http://localhost:8081';
const TOKEN = 'token-123';
const AUTH = { headers: { Authorization: `Bearer ${TOKEN}` } };

describe('ReportesService', () => {
  let service: ReportesService;
  let getMock: jest.Mock;
  let postMock: jest.Mock;
  let patchMock: jest.Mock;

  beforeEach(async () => {
    getMock = jest.fn().mockResolvedValue({ data: { ok: true } });
    postMock = jest.fn().mockResolvedValue({ data: { id: 1 } });
    patchMock = jest.fn().mockResolvedValue({ data: { id: 1 } });
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportesService,
        {
          provide: HttpService,
          useValue: {
            axiosRef: { get: getMock, post: postMock, patch: patchMock },
          },
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue(MS_URL) },
        },
      ],
    }).compile();
    service = module.get(ReportesService);
  });

  it('crear() posts the body to /api/reportes with the Bearer token', async () => {
    const dto = { organizacionId: 4, motivo: 'INACTIVO' };
    await expect(service.crear(dto, TOKEN)).resolves.toEqual({ id: 1 });
    expect(postMock).toHaveBeenCalledWith(`${MS_URL}/api/reportes`, dto, AUTH);
  });

  it('cercanas() and detalle() read with the Bearer token', async () => {
    await service.cercanas(4, TOKEN);
    await service.detalle(9, TOKEN);
    expect(getMock).toHaveBeenNthCalledWith(
      1,
      `${MS_URL}/api/reportes/cercanas?organizacionId=4`,
      AUTH,
    );
    expect(getMock).toHaveBeenNthCalledWith(
      2,
      `${MS_URL}/api/reportes/9`,
      AUTH,
    );
  });

  it('pendientes() forwards page/size/sort only when present', async () => {
    await service.pendientes(TOKEN, '1', '5', 'creadoEn,asc');
    await service.pendientes(TOKEN);
    expect(getMock).toHaveBeenNthCalledWith(
      1,
      `${MS_URL}/api/reportes/pendientes?page=1&size=5&sort=creadoEn%2Casc`,
      AUTH,
    );
    expect(getMock).toHaveBeenNthCalledWith(
      2,
      `${MS_URL}/api/reportes/pendientes`,
      AUTH,
    );
  });

  it('marcarInactiva() and descartar() patch the MS', async () => {
    await service.marcarInactiva(3, TOKEN);
    await service.descartar(3, { nota: 'no' }, TOKEN);
    expect(patchMock).toHaveBeenNthCalledWith(
      1,
      `${MS_URL}/api/reportes/3/marcar-inactiva`,
      {},
      AUTH,
    );
    expect(patchMock).toHaveBeenNthCalledWith(
      2,
      `${MS_URL}/api/reportes/3/descartar`,
      { nota: 'no' },
      AUTH,
    );
  });

  it('lets MS errors (404/409/403) propagate to the shared exception filter', async () => {
    const err = new Error('conflict');
    postMock.mockRejectedValue(err);
    await expect(
      service.crear({ organizacionId: 4, motivo: 'OTRO' }, TOKEN),
    ).rejects.toBe(err);
  });
});
