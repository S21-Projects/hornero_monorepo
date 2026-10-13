import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { isAxiosError } from 'axios';
import { buildQuery } from '../common/build-query.js';
import { CrearReclamoDto } from './dto/crear-reclamo.dto.js';
import { RechazarReclamoDto } from './dto/rechazar-reclamo.dto.js';

/**
 * Thin proxy to the MS's `ReclamoController` (`/api/reclamos`). Every route is authenticated, so
 * every method forwards the access_token cookie as a Bearer header. The Idempotency-Key of
 * `POST /reclamos` is carried by the shared axios interceptor (`common/client-ip.ts`).
 */
@Injectable()
export class ReclamosService {
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

  async crear(dto: CrearReclamoDto, accessToken: string) {
    const { data } = await this.httpService.axiosRef.post<unknown>(
      `${this.msUrl}/api/reclamos`,
      dto,
      this.authHeaders(accessToken),
    );
    return data;
  }

  async mios(accessToken: string) {
    const { data } = await this.httpService.axiosRef.get<unknown>(
      `${this.msUrl}/api/reclamos/mios`,
      this.authHeaders(accessToken),
    );
    return data;
  }

  async pendientes(
    accessToken: string,
    page?: string,
    size?: string,
    sort?: string,
  ) {
    const { data } = await this.httpService.axiosRef.get<unknown>(
      `${this.msUrl}/api/reclamos/pendientes${buildQuery({ page, size, sort })}`,
      this.authHeaders(accessToken),
    );
    return data;
  }

  async detalle(id: number, accessToken: string) {
    const { data } = await this.httpService.axiosRef.get<unknown>(
      `${this.msUrl}/api/reclamos/${id}`,
      this.authHeaders(accessToken),
    );
    return data;
  }

  async aprobar(id: number, accessToken: string) {
    const { data } = await this.httpService.axiosRef.patch<unknown>(
      `${this.msUrl}/api/reclamos/${id}/aprobar`,
      {},
      this.authHeaders(accessToken),
    );
    return data;
  }

  async rechazar(id: number, dto: RechazarReclamoDto, accessToken: string) {
    const { data } = await this.httpService.axiosRef.patch<unknown>(
      `${this.msUrl}/api/reclamos/${id}/rechazar`,
      dto,
      this.authHeaders(accessToken),
    );
    return data;
  }

  /**
   * Pre-flight for the evidence upload: the MS answers 204 when the caller could claim the
   * organizacion now, 404 if it does not exist, 409 if it is not claimable / already pending / over
   * the cap. Mapped like the rest of the claim flow so nothing is written to storage otherwise.
   */
  async verificarReclamable(
    organizacionId: number,
    accessToken: string,
  ): Promise<void> {
    try {
      await this.httpService.axiosRef.get<unknown>(
        `${this.msUrl}/api/reclamos/disponibilidad`,
        { ...this.authHeaders(accessToken), params: { organizacionId } },
      );
    } catch (err) {
      if (isAxiosError(err)) {
        const status = err.response?.status;
        if (status === 404) throw new NotFoundException('Comedor no encontrado');
        if (status === 409)
          throw new ConflictException(
            'No podés reclamar este comedor en este momento',
          );
        if (status === 403)
          throw new ForbiddenException('Solo los referentes pueden reclamar');
      }
      throw err;
    }
  }

  /**
   * Authorizes reading a claim evidence file before `ReclamoFilesController` streams it: the MS
   * checks the key is bound to a claim row of `solicitanteId` and that the caller is an admin or
   * that claimant. Resolves on the MS's `204`; maps 403/404/400 like the accreditation evidence.
   */
  async verificarArchivo(
    organizacionId: number,
    solicitanteId: number,
    objectKey: string,
    accessToken: string,
  ): Promise<void> {
    try {
      await this.httpService.axiosRef.get<unknown>(
        `${this.msUrl}/api/reclamos/archivo`,
        {
          ...this.authHeaders(accessToken),
          params: { organizacionId, solicitanteId, objectKey },
        },
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
