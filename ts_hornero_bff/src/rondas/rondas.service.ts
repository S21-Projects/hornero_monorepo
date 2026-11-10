import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { buildQuery } from '../common/build-query.js';

/**
 * Thin proxy over the MS's `RondaController` (`/api/rondas`, slice 5c-ii) — ADMINISTRADOR-only
 * manual ronda trigger and history, per `specs/ronda-asignacion/spec.md`.
 */
@Injectable()
export class RondasService {
  constructor(
    private httpService: HttpService,
    private configService: ConfigService,
  ) {}

  private get msUrl(): string {
    return this.configService.get<string>('JAVA_MS_URL') as string;
  }

  private authHeaders(accessToken: string) {
    return { Authorization: `Bearer ${accessToken}` };
  }

  async ejecutar(accessToken: string) {
    const { data } = await this.httpService.axiosRef.post(
      `${this.msUrl}/api/rondas`,
      null,
      { headers: this.authHeaders(accessToken) },
    );
    return data;
  }

  async listar(
    accessToken: string,
    page?: string,
    size?: string,
    sort?: string,
  ) {
    const url = `${this.msUrl}/api/rondas${buildQuery({ page, size, sort })}`;
    const { data } = await this.httpService.axiosRef.get(url, {
      headers: this.authHeaders(accessToken),
    });
    return data;
  }

  async detalle(id: number, accessToken: string) {
    const { data } = await this.httpService.axiosRef.get(
      `${this.msUrl}/api/rondas/${id}`,
      { headers: this.authHeaders(accessToken) },
    );
    return data;
  }

  async fondo(accessToken: string) {
    const { data } = await this.httpService.axiosRef.get(
      `${this.msUrl}/api/rondas/fondo`,
      { headers: this.authHeaders(accessToken) },
    );
    return data;
  }
}
