import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { buildQuery } from '../common/build-query.js';

/** Query parameters the MS `GET /api/actividad` understands. */
export interface ActividadFiltros {
  page?: string;
  size?: string;
  actorUsuarioId?: string;
  accion?: string;
  resultado?: string;
  entidadTipo?: string;
  entidadId?: string;
  desde?: string;
  hasta?: string;
}

/** Thin read-only proxy over the MS activity log (N10). */
@Injectable()
export class ActividadService {
  constructor(
    private httpService: HttpService,
    private configService: ConfigService,
  ) {}

  private get msUrl(): string {
    return this.configService.get<string>('JAVA_MS_URL') as string;
  }

  async listar(accessToken: string, filtros: ActividadFiltros) {
    const url = `${this.msUrl}/api/actividad${buildQuery({
      page: filtros.page,
      size: filtros.size,
      actorUsuarioId: filtros.actorUsuarioId,
      accion: filtros.accion,
      resultado: filtros.resultado,
      entidadTipo: filtros.entidadTipo,
      entidadId: filtros.entidadId,
      desde: filtros.desde,
      hasta: filtros.hasta,
    })}`;
    const { data } = await this.httpService.axiosRef.get(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return data;
  }
}
