import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { isAxiosError } from 'axios';
import { CargarEvidenciaDto } from './dto/cargar-evidencia.dto.js';
import { CambiarNivelDto } from './dto/cambiar-nivel.dto.js';
import { AuditarEvidenciaDto } from './dto/auditar-evidencia.dto.js';

/**
 * Thin proxy to the MS's `AcreditacionController` — no domain logic here. Every route requires a
 * token, unlike necesidades/organizaciones: none of the six accreditation endpoints are public,
 * so every method forwards the access_token cookie as an `Authorization: Bearer` header
 * (mirroring `NecesidadesService.crear`).
 */
@Injectable()
export class AcreditacionService {
  constructor(
    private httpService: HttpService,
    private configService: ConfigService,
  ) {}

  private get msUrl(): string {
    return this.configService.get<string>('JAVA_MS_URL') as string;
  }

  private authHeaders(accessToken: string) {
    return { headers: { Authorization: `Bearer ${accessToken}` } };
  }

  async acreditacion(organizacionId: number, accessToken: string) {
    const { data } = await this.httpService.axiosRef.get<unknown>(
      `${this.msUrl}/api/organizaciones/${organizacionId}/acreditacion`,
      this.authHeaders(accessToken),
    );
    return data;
  }

  async cargarEvidencia(
    organizacionId: number,
    dto: CargarEvidenciaDto,
    accessToken: string,
  ) {
    const { data } = await this.httpService.axiosRef.post<unknown>(
      `${this.msUrl}/api/organizaciones/${organizacionId}/acreditacion/evidencias`,
      dto,
      this.authHeaders(accessToken),
    );
    return data;
  }

  async aprobarEvidencia(
    organizacionId: number,
    evId: number,
    accessToken: string,
  ) {
    const { data } = await this.httpService.axiosRef.patch<unknown>(
      `${this.msUrl}/api/organizaciones/${organizacionId}/acreditacion/evidencias/${evId}/aprobar`,
      {},
      this.authHeaders(accessToken),
    );
    return data;
  }

  async observarEvidencia(
    organizacionId: number,
    evId: number,
    dto: AuditarEvidenciaDto,
    accessToken: string,
  ) {
    const { data } = await this.httpService.axiosRef.patch<unknown>(
      `${this.msUrl}/api/organizaciones/${organizacionId}/acreditacion/evidencias/${evId}/observar`,
      dto,
      this.authHeaders(accessToken),
    );
    return data;
  }

  async cambiarNivel(
    organizacionId: number,
    dto: CambiarNivelDto,
    accessToken: string,
  ) {
    const { data } = await this.httpService.axiosRef.patch<unknown>(
      `${this.msUrl}/api/organizaciones/${organizacionId}/acreditacion/nivel`,
      dto,
      this.authHeaders(accessToken),
    );
    return data;
  }

  async legajo(organizacionId: number, accessToken: string) {
    const { data } = await this.httpService.axiosRef.get<unknown>(
      `${this.msUrl}/api/organizaciones/${organizacionId}/legajo`,
      this.authHeaders(accessToken),
    );
    return data;
  }

  /** D-02: audit-queue read. `estado` mirrors the MS's optional query param exactly. */
  async evidencias(
    organizacionId: number,
    estado: string | undefined,
    accessToken: string,
  ) {
    const query = estado ? `?estado=${estado}` : '';
    const { data } = await this.httpService.axiosRef.get<unknown>(
      `${this.msUrl}/api/organizaciones/${organizacionId}/acreditacion/evidencias${query}`,
      this.authHeaders(accessToken),
    );
    return data;
  }

  /**
   * AD-12 (tesis-core-features slice 2): authorizes reading an evidence file bound to an existing
   * row before the caller (`EvidenciaFilesController`) streams it — the MS is the single authority
   * for both ownership and row binding. `objectKey` is forwarded raw through axios' `params`
   * (which URL-encodes it), not pre-encoded here. Resolves with no value on the MS's `204`; maps
   * `403 -> ForbiddenException`, `404 -> NotFoundException`, `400 -> BadRequestException`; any
   * other axios error is rethrown unchanged.
   */
  async verificarArchivoEvidencia(
    organizacionId: number,
    objectKey: string,
    accessToken: string,
  ): Promise<void> {
    try {
      await this.httpService.axiosRef.get<unknown>(
        `${this.msUrl}/api/organizaciones/${organizacionId}/acreditacion/evidencias/archivo`,
        { ...this.authHeaders(accessToken), params: { objectKey } },
      );
    } catch (err) {
      if (isAxiosError(err)) {
        const status = err.response?.status;
        if (status === 403)
          throw new ForbiddenException('No autorizado para este archivo');
        if (status === 404)
          throw new NotFoundException('Evidencia no encontrada');
        if (status === 400)
          throw new BadRequestException('Clave de evidencia inválida');
      }
      throw err;
    }
  }
}
