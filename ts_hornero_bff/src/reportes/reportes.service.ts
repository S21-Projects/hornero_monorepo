import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { buildQuery } from '../common/build-query.js';
import { CrearReporteDto } from './dto/crear-reporte.dto.js';
import { DescartarReporteDto } from './dto/descartar-reporte.dto.js';

/**
 * Thin proxy to the MS's `ReporteController` (`/api/reportes`). Every route is authenticated, so
 * every method forwards the access_token cookie as a Bearer header. The Idempotency-Key of
 * `POST /reportes` is carried by the shared axios interceptor (`common/client-ip.ts`).
 */
@Injectable()
export class ReportesService {
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

  async crear(dto: CrearReporteDto, accessToken: string) {
    const { data } = await this.httpService.axiosRef.post<unknown>(
      `${this.msUrl}/api/reportes`,
      dto,
      this.authHeaders(accessToken),
    );
    return data;
  }

  async cercanas(organizacionId: number, accessToken: string) {
    const { data } = await this.httpService.axiosRef.get<unknown>(
      `${this.msUrl}/api/reportes/cercanas${buildQuery({ organizacionId: String(organizacionId) })}`,
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
      `${this.msUrl}/api/reportes/pendientes${buildQuery({ page, size, sort })}`,
      this.authHeaders(accessToken),
    );
    return data;
  }

  async detalle(id: number, accessToken: string) {
    const { data } = await this.httpService.axiosRef.get<unknown>(
      `${this.msUrl}/api/reportes/${id}`,
      this.authHeaders(accessToken),
    );
    return data;
  }

  async marcarInactiva(id: number, accessToken: string) {
    const { data } = await this.httpService.axiosRef.patch<unknown>(
      `${this.msUrl}/api/reportes/${id}/marcar-inactiva`,
      {},
      this.authHeaders(accessToken),
    );
    return data;
  }

  async descartar(id: number, dto: DescartarReporteDto, accessToken: string) {
    const { data } = await this.httpService.axiosRef.patch<unknown>(
      `${this.msUrl}/api/reportes/${id}/descartar`,
      dto,
      this.authHeaders(accessToken),
    );
    return data;
  }
}
