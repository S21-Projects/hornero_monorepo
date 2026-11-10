import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { buildQuery } from '../common/build-query.js';
import { CrearArticuloDto } from './dto/crear-articulo.dto.js';
import { ActualizarArticuloDto } from './dto/actualizar-articulo.dto.js';

@Injectable()
export class ArticulosService {
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

  async listar(incluirInactivos: boolean) {
    const url = `${this.msUrl}/api/articulos${incluirInactivos ? '?incluirInactivos=true' : ''}`;
    const { data } = await this.httpService.axiosRef.get(url);
    return data;
  }

  /** Admin catalog listing: paged, filtered server-side by `q` / `categoria` / `incluirInactivos`. */
  async listarAdmin(
    accessToken: string,
    params: {
      q?: string;
      categoria?: string;
      incluirInactivos?: string;
      page?: string;
      size?: string;
      sort?: string;
    } = {},
  ) {
    const url = `${this.msUrl}/api/articulos/admin${buildQuery(params)}`;
    const { data } = await this.httpService.axiosRef.get(url, {
      headers: this.authHeaders(accessToken),
    });
    return data;
  }

  async crear(dto: CrearArticuloDto, accessToken: string) {
    const { data } = await this.httpService.axiosRef.post(
      `${this.msUrl}/api/articulos`,
      dto,
      { headers: this.authHeaders(accessToken) },
    );
    return data;
  }

  async actualizar(
    id: number,
    dto: ActualizarArticuloDto,
    accessToken: string,
  ) {
    const { data } = await this.httpService.axiosRef.put(
      `${this.msUrl}/api/articulos/${id}`,
      dto,
      { headers: this.authHeaders(accessToken) },
    );
    return data;
  }

  async desactivar(id: number, accessToken: string) {
    const { data } = await this.httpService.axiosRef.patch(
      `${this.msUrl}/api/articulos/${id}/desactivar`,
      {},
      { headers: this.authHeaders(accessToken) },
    );
    return data;
  }

  async reactivar(id: number, accessToken: string) {
    const { data } = await this.httpService.axiosRef.patch(
      `${this.msUrl}/api/articulos/${id}/reactivar`,
      {},
      { headers: this.authHeaders(accessToken) },
    );
    return data;
  }
}
