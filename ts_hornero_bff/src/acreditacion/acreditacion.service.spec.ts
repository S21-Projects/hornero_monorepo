import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
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
});
