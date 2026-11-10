import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { AxiosError, AxiosHeaders } from 'axios';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ReclamosService } from './reclamos.service';

const MS_URL = 'http://localhost:8081';
const TOKEN = 'token-123';
const AUTH = { headers: { Authorization: `Bearer ${TOKEN}` } };

describe('ReclamosService', () => {
  let service: ReclamosService;
  let getMock: jest.Mock;
  let postMock: jest.Mock;
  let patchMock: jest.Mock;

  beforeEach(async () => {
    getMock = jest.fn().mockResolvedValue({ data: { ok: true } });
    postMock = jest.fn().mockResolvedValue({ data: { id: 1 } });
    patchMock = jest.fn().mockResolvedValue({ data: { id: 1 } });
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReclamosService,
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
    service = module.get(ReclamosService);
  });

  it('crear() posts the body to /api/reclamos with the Bearer token', async () => {
    const dto = {
      organizacionId: 4,
      rol: 'RESPONSABLE',
      telefono: '351 555 1234',
      evidenciaKeys: ['reclamo-evidencia/4/7/1.jpg'],
    };
    await expect(service.crear(dto, TOKEN)).resolves.toEqual({ id: 1 });
    expect(postMock).toHaveBeenCalledWith(`${MS_URL}/api/reclamos`, dto, AUTH);
  });

  it('mios() and detalle() read with the Bearer token', async () => {
    await service.mios(TOKEN);
    await service.detalle(9, TOKEN);
    expect(getMock).toHaveBeenNthCalledWith(
      1,
      `${MS_URL}/api/reclamos/mios`,
      AUTH,
    );
    expect(getMock).toHaveBeenNthCalledWith(
      2,
      `${MS_URL}/api/reclamos/9`,
      AUTH,
    );
  });

  it('pendientes() forwards page/size/sort only when present', async () => {
    await service.pendientes(TOKEN, '1', '5', 'creadoEn,asc');
    await service.pendientes(TOKEN);
    expect(getMock).toHaveBeenNthCalledWith(
      1,
      `${MS_URL}/api/reclamos/pendientes?page=1&size=5&sort=creadoEn%2Casc`,
      AUTH,
    );
    expect(getMock).toHaveBeenNthCalledWith(
      2,
      `${MS_URL}/api/reclamos/pendientes`,
      AUTH,
    );
  });

  it('aprobar() and rechazar() patch the MS', async () => {
    await service.aprobar(9, TOKEN);
    await service.rechazar(9, { motivo: 'No se pudo verificar' }, TOKEN);
    expect(patchMock).toHaveBeenNthCalledWith(
      1,
      `${MS_URL}/api/reclamos/9/aprobar`,
      {},
      AUTH,
    );
    expect(patchMock).toHaveBeenNthCalledWith(
      2,
      `${MS_URL}/api/reclamos/9/rechazar`,
      { motivo: 'No se pudo verificar' },
      AUTH,
    );
  });

  describe('verificarReclamable()', () => {
    const axiosError = (status: number) =>
      new AxiosError('x', String(status), undefined, undefined, {
        status,
        statusText: '',
        data: {},
        headers: {},
        config: { headers: new AxiosHeaders() },
      });

    it('asks the MS pre-flight endpoint and resolves on 204', async () => {
      await expect(service.verificarReclamable(4, TOKEN)).resolves.toBeUndefined();
      expect(getMock).toHaveBeenCalledWith(`${MS_URL}/api/reclamos/disponibilidad`, {
        ...AUTH,
        params: { organizacionId: 4 },
      });
    });

    it.each([
      [404, NotFoundException],
      [409, ConflictException],
      [403, ForbiddenException],
    ])('maps MS %i to the matching exception', async (status, ctor) => {
      getMock.mockRejectedValue(axiosError(status));
      await expect(service.verificarReclamable(4, TOKEN)).rejects.toBeInstanceOf(ctor);
    });
  });

  describe('verificarArchivo()', () => {
    const axiosError = (status: number) =>
      new AxiosError('x', String(status), undefined, undefined, {
        status,
        statusText: '',
        data: {},
        headers: {},
        config: { headers: new AxiosHeaders() },
      });

    it('passes the ids and key as params and resolves on 204', async () => {
      await expect(
        service.verificarArchivo(4, 7, 'reclamo-evidencia/4/7/1.jpg', TOKEN),
      ).resolves.toBeUndefined();
      expect(getMock).toHaveBeenCalledWith(`${MS_URL}/api/reclamos/archivo`, {
        ...AUTH,
        params: {
          organizacionId: 4,
          solicitanteId: 7,
          objectKey: 'reclamo-evidencia/4/7/1.jpg',
        },
      });
    });

    it.each([
      [403, ForbiddenException],
      [404, NotFoundException],
      [400, BadRequestException],
    ])('maps MS %i to the matching exception', async (status, ctor) => {
      getMock.mockRejectedValue(axiosError(status));
      await expect(
        service.verificarArchivo(4, 7, 'k', TOKEN),
      ).rejects.toBeInstanceOf(ctor);
    });

    it('rethrows anything else unchanged', async () => {
      const boom = axiosError(500);
      getMock.mockRejectedValue(boom);
      await expect(service.verificarArchivo(4, 7, 'k', TOKEN)).rejects.toBe(
        boom,
      );
    });
  });
});
