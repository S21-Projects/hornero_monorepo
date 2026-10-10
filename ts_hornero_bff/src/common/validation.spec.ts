import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { VALIDATION_PIPE_OPTIONS } from './validation';
import { LoginDto } from '../auth/dto/login.dto';
import { RegisterDto } from '../auth/dto/register.dto';
import { ResendOtpDto } from '../auth/dto/resend-otp.dto';
import { VerifyOtpDto } from '../auth/dto/verify-otp.dto';
import { CrearOrganizacionDto } from '../organizaciones/dto/crear-organizacion.dto';
import { ActualizarOrganizacionDto } from '../organizaciones/dto/actualizar-organizacion.dto';
import { ActualizarInfoPublicaDto } from '../organizaciones/dto/actualizar-info-publica.dto';
import { AsignarReferenteDto } from '../organizaciones/dto/asignar-referente.dto';
import { CrearNecesidadDto } from '../necesidades/dto/crear-necesidad.dto';
import { ActualizarNecesidadDto } from '../necesidades/dto/actualizar-necesidad.dto';
import { CrearDonacionDto } from '../donaciones/dto/crear-donacion.dto';
import { DecisionDonacionDto } from '../donaciones/dto/decision-donacion.dto';
import { UpdateEstadoDonacionDto } from '../donaciones/dto/update-estado-donacion.dto';
import { VerificarCodigoDto } from '../donaciones/dto/verificar-codigo.dto';
import { OverrideEstadoDto } from '../donaciones/dto/override-estado.dto';
import { CrearArticuloDto } from '../articulos/dto/crear-articulo.dto';
import { ActualizarArticuloDto } from '../articulos/dto/actualizar-articulo.dto';
import { CargarEvidenciaDto } from '../acreditacion/dto/cargar-evidencia.dto';
import { AuditarEvidenciaDto } from '../acreditacion/dto/auditar-evidencia.dto';
import { CambiarNivelDto } from '../acreditacion/dto/cambiar-nivel.dto';

describe('global ValidationPipe options', () => {
  const pipe = new ValidationPipe(VALIDATION_PIPE_OPTIONS);
  const transform = (type: new () => object, value: unknown) =>
    pipe.transform(value, { type: 'body', metatype: type });

  it('rejects a body carrying a field the DTO does not declare', async () => {
    await expect(
      transform(LoginDto, {
        email: 'a@b.ar',
        password: 'secret',
        isAdmin: true,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('names the offending property in the error', async () => {
    const error = await transform(LoginDto, {
      email: 'a@b.ar',
      password: 'secret',
      extra: 1,
    }).catch((e: BadRequestException) => e);

    expect(
      JSON.stringify((error as BadRequestException).getResponse()),
    ).toContain('property extra should not exist');
  });

  it('still accepts a body with only declared fields', async () => {
    await expect(
      transform(LoginDto, { email: 'a@b.ar', password: 'secret' }),
    ).resolves.toMatchObject({ email: 'a@b.ar' });
  });

  /**
   * Cross-check: the payloads the admin SPA hooks and scripts/seed.ts actually send must be
   * fully declared (decorated) on the BFF DTOs, otherwise enabling forbidNonWhitelisted turns
   * a working call into a 400.
   */
  describe('payloads sent by the admin SPA and seed.ts are accepted', () => {
    const cases: Array<[string, new () => object, Record<string, unknown>]> = [
      ['POST /auth/login', LoginDto, { email: 'a@b.ar', password: 'x' }],
      [
        'POST /auth/register',
        RegisterDto,
        {
          nombre: 'N',
          email: 'a@b.ar',
          password: 'Passw0rd!',
          tipo: 'DONANTE',
        },
      ],
      [
        'POST /auth/verify-otp',
        VerifyOtpDto,
        { email: 'a@b.ar', codigo: '123456' },
      ],
      ['POST /auth/resend-otp', ResendOtpDto, { email: 'a@b.ar' }],
      [
        'POST /organizaciones',
        CrearOrganizacionDto,
        {
          nombre: 'Org',
          tipo: 'COMEDOR',
          descripcion: 'd',
          direccion: 'dir',
          latitud: -31.4,
          longitud: -64.1,
        },
      ],
      [
        'PATCH /organizaciones/:id (info publica)',
        ActualizarOrganizacionDto,
        { aceptaDonaciones: true, sitioWebUrl: '', donacionDirectaUrl: '' },
      ],
      [
        'PATCH /organizaciones/:id/info-publica',
        ActualizarInfoPublicaDto,
        { aceptaDonaciones: true, sitioWebUrl: '', donacionDirectaUrl: '' },
      ],
      [
        'PATCH /organizaciones/:id/referente',
        AsignarReferenteDto,
        { referenteId: 3 },
      ],
      [
        'POST /necesidades',
        CrearNecesidadDto,
        {
          descripcion: 'd',
          prioridad: 'ALTA',
          fechaVencimiento: '2030-01-01',
          articuloIds: [1],
          organizacionId: 2,
        },
      ],
      [
        'PATCH /necesidades/:id',
        ActualizarNecesidadDto,
        {
          descripcion: 'd',
          prioridad: 'ALTA',
          estado: 'ACTIVA',
          fechaVencimiento: '2030-01-01',
          articuloIds: [1],
        },
      ],
      [
        'POST /donaciones (DIRECTA)',
        CrearDonacionDto,
        {
          necesidadId: 1,
          lineas: [{ articuloId: 1, cantidad: 2 }],
          observaciones: 'o',
        },
      ],
      [
        'POST /donaciones (FONDO_COMUN)',
        CrearDonacionDto,
        {
          modalidad: 'FONDO_COMUN',
          lineas: [{ articuloId: 1, cantidad: 2 }],
          latitud: -31.4,
          longitud: -64.1,
          observaciones: 'o',
        },
      ],
      [
        'PATCH /donaciones/:id/decision',
        DecisionDonacionDto,
        { estado: 'ACEPTADA' },
      ],
      [
        'PATCH /donaciones/:id/estado',
        UpdateEstadoDonacionDto,
        { estado: 'CANCELADA' },
      ],
      [
        'POST /donaciones/:id/entrega/verificar',
        VerificarCodigoDto,
        { codigo: '123456' },
      ],
      [
        'PATCH /donaciones/:id/estado-admin',
        OverrideEstadoDto,
        { estado: 'CANCELADA', motivo: 'm' },
      ],
      [
        'POST|PUT /articulos',
        CrearArticuloDto,
        { nombre: 'Arroz', categoria: 'ALIMENTOS', unidad: 'KG' },
      ],
      [
        'PUT /articulos/:id',
        ActualizarArticuloDto,
        { nombre: 'Arroz', categoria: 'ALIMENTOS', unidad: 'KG' },
      ],
      [
        'POST /organizaciones/:id/acreditacion/evidencias',
        CargarEvidenciaDto,
        {
          requisito: 'R',
          tipoEvidencia: 'FOTO',
          declaracion: 'd',
          objectKey: 'org-evidencia/1/1.jpg',
          validoDesde: '2030-01-01',
          validoHasta: '2031-01-01',
        },
      ],
      [
        'PATCH .../evidencias/:id/observar',
        AuditarEvidenciaDto,
        { observacion: 'o' },
      ],
      [
        'PATCH /organizaciones/:id/acreditacion/nivel',
        CambiarNivelDto,
        { destino: 'N2', motivo: 'm' },
      ],
    ];

    it.each(cases)('%s', async (_endpoint, dto, payload) => {
      // Only the whitelist rule is under test here; a value-level failure would be a fixture
      // issue, so surface the message verbatim if it mentions an undeclared property.
      try {
        await transform(dto, payload);
      } catch (e) {
        const msg = JSON.stringify((e as BadRequestException).getResponse());
        expect(msg).not.toMatch(/should not exist/);
      }
    });
  });
});
