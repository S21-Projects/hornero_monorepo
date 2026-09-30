import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { AxiosError, AxiosHeaders } from 'axios';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { AcreditacionService } from './acreditacion.service';

const MS_URL = 'http://localhost:8081';
const TOKEN = 'token-123';

/**
 * The AcreditacionService is a thin `HttpService` proxy with no domain logic (mirroring
 * `NecesidadesService.crear`): every call must forward the access_token cookie as an
 * `Authorization: Bearer` header to `${JAVA_MS_URL}/api/organizaciones/{id}/...`. Unlike
 * necesidades/organizaciones, none of the six accreditation routes are public — every method
 * requires the token.
 */
describe('AcreditacionService', () => {
  let service: AcreditacionService;
  let getMock: jest.Mock;
  let postMock: jest.Mock;
  let patchMock: jest.Mock;

  beforeEach(async () => {
    getMock = jest.fn().mockResolvedValue({ data: { organizacionId: 1 } });
    postMock = jest.fn().mockResolvedValue({ data: { id: 10 } });
    patchMock = jest.fn().mockResolvedValue({ data: { id: 10 } });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AcreditacionService,
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

    service = module.get<AcreditacionService>(AcreditacionService);
  });

  it('forwards the token as Authorization: Bearer for acreditacion()', async () => {
    await service.acreditacion(1, TOKEN);
    expect(getMock).toHaveBeenCalledWith(
      `${MS_URL}/api/organizaciones/1/acreditacion`,
      {
        headers: { Authorization: `Bearer ${TOKEN}` },
      },
    );
  });

  it('forwards the token and body for cargarEvidencia()', async () => {
    const dto = {
      requisito: 'NO_DISCRIMINACION',
      tipoEvidencia: 'DECLARACION',
    };
    await service.cargarEvidencia(1, dto, TOKEN);
    expect(postMock).toHaveBeenCalledWith(
      `${MS_URL}/api/organizaciones/1/acreditacion/evidencias`,
      dto,
      { headers: { Authorization: `Bearer ${TOKEN}` } },
    );
  });

  it('forwards the token for aprobarEvidencia() with no body', async () => {
    await service.aprobarEvidencia(1, 10, TOKEN);
    expect(patchMock).toHaveBeenCalledWith(
      `${MS_URL}/api/organizaciones/1/acreditacion/evidencias/10/aprobar`,
      {},
      { headers: { Authorization: `Bearer ${TOKEN}` } },
    );
  });

  it('forwards the token and body for observarEvidencia()', async () => {
    const dto = { observacion: 'falta firma' };
    await service.observarEvidencia(1, 10, dto, TOKEN);
    expect(patchMock).toHaveBeenCalledWith(
      `${MS_URL}/api/organizaciones/1/acreditacion/evidencias/10/observar`,
      dto,
      { headers: { Authorization: `Bearer ${TOKEN}` } },
    );
  });

  it('forwards the token and body for cambiarNivel()', async () => {
    const dto = { destino: 'N1', motivo: 'cumple requisitos' };
    await service.cambiarNivel(1, dto, TOKEN);
    expect(patchMock).toHaveBeenCalledWith(
      `${MS_URL}/api/organizaciones/1/acreditacion/nivel`,
      dto,
      { headers: { Authorization: `Bearer ${TOKEN}` } },
    );
  });

  it('forwards the token as Authorization: Bearer for legajo()', async () => {
    await service.legajo(1, TOKEN);
    expect(getMock).toHaveBeenCalledWith(
      `${MS_URL}/api/organizaciones/1/legajo`,
      {
        headers: { Authorization: `Bearer ${TOKEN}` },
      },
    );
  });

  // --- Task 4b.5 (D-02): audit-queue read — GET .../acreditacion/evidencias ---

  it('forwards the token as Authorization: Bearer for evidencias() with no filter', async () => {
    await service.evidencias(1, undefined, TOKEN);
    expect(getMock).toHaveBeenCalledWith(
      `${MS_URL}/api/organizaciones/1/acreditacion/evidencias`,
      {
        headers: { Authorization: `Bearer ${TOKEN}` },
      },
    );
  });

  it('mirrors the MS estado query param exactly when a filter is supplied', async () => {
    await service.evidencias(1, 'PENDIENTE', TOKEN);
    expect(getMock).toHaveBeenCalledWith(
      `${MS_URL}/api/organizaciones/1/acreditacion/evidencias?estado=PENDIENTE`,
      {
        headers: { Authorization: `Bearer ${TOKEN}` },
      },
    );
  });

  // --- AD-12 (tesis-core-features slice 2): evidence-file access authorization ---

  const OBJECT_KEY = 'org-evidencia/1/foto raro.jpg';

  function axiosErrorWithStatus(status: number): AxiosError {
    return new AxiosError(
      'Request failed',
      String(status),
      undefined,
      undefined,
      {
        status,
        statusText: '',
        headers: {},
        config: { headers: new AxiosHeaders() },
        data: {},
      },
    );
  }

  it('resolves with no value when the MS answers 204 (a matching row exists)', async () => {
    getMock.mockResolvedValueOnce({ data: undefined, status: 204 });

    await expect(
      service.verificarArchivoEvidencia(1, OBJECT_KEY, TOKEN),
    ).resolves.toBeUndefined();

    expect(getMock).toHaveBeenCalledWith(
      `${MS_URL}/api/organizaciones/1/acreditacion/evidencias/archivo`,
      {
        headers: { Authorization: `Bearer ${TOKEN}` },
        params: { objectKey: OBJECT_KEY },
      },
    );
  });

  it('throws ForbiddenException when the MS answers 403', async () => {
    getMock.mockRejectedValueOnce(axiosErrorWithStatus(403));

    await expect(
      service.verificarArchivoEvidencia(1, OBJECT_KEY, TOKEN),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('throws NotFoundException when the MS answers 404', async () => {
    getMock.mockRejectedValueOnce(axiosErrorWithStatus(404));

    await expect(
      service.verificarArchivoEvidencia(1, OBJECT_KEY, TOKEN),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('throws BadRequestException when the MS answers 400', async () => {
    getMock.mockRejectedValueOnce(axiosErrorWithStatus(400));

    await expect(
      service.verificarArchivoEvidencia(1, OBJECT_KEY, TOKEN),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rethrows an unrelated axios error unchanged', async () => {
    const networkError = axiosErrorWithStatus(500);
    getMock.mockRejectedValueOnce(networkError);

    await expect(
      service.verificarArchivoEvidencia(1, OBJECT_KEY, TOKEN),
    ).rejects.toBe(networkError);
  });

  // --- AD-8 (tesis-core-features slice 4a): cross-org audit queue ---

  it('forwards every filter to the MS auditoria/evidencias endpoint with the Bearer header', async () => {
    getMock.mockResolvedValueOnce({
      data: { content: [], totalElements: 0 },
    });

    await service.colaAuditoria(
      {
        tab: 'VENCIDAS',
        nivel: 'N2',
        requisito: 'RADIO_50KM_BANCO_ALIMENTOS',
        tipoEvidencia: 'FOTO',
        page: '1',
        size: '10',
        sort: 'cargadoEn,desc',
      },
      TOKEN,
    );

    expect(getMock).toHaveBeenCalledWith(
      `${MS_URL}/api/auditoria/evidencias?tab=VENCIDAS&nivel=N2&requisito=RADIO_50KM_BANCO_ALIMENTOS&tipoEvidencia=FOTO&page=1&size=10&sort=cargadoEn%2Cdesc`,
      { headers: { Authorization: `Bearer ${TOKEN}` } },
    );
  });

  it('omits unset filters from the forwarded query string', async () => {
    getMock.mockResolvedValueOnce({
      data: { content: [], totalElements: 0 },
    });

    await service.colaAuditoria(
      {
        tab: undefined,
        nivel: undefined,
        requisito: undefined,
        tipoEvidencia: undefined,
        page: undefined,
        size: undefined,
        sort: undefined,
      },
      TOKEN,
    );

    expect(getMock).toHaveBeenCalledWith(`${MS_URL}/api/auditoria/evidencias`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
  });

  it('returns the MS response body unchanged', async () => {
    const response = { content: [{ id: 5 }], totalElements: 1 };
    getMock.mockResolvedValueOnce({ data: response });

    const result = await service.colaAuditoria(
      {
        tab: undefined,
        nivel: undefined,
        requisito: undefined,
        tipoEvidencia: undefined,
        page: undefined,
        size: undefined,
        sort: undefined,
      },
      TOKEN,
    );

    expect(result).toBe(response);
  });
});
