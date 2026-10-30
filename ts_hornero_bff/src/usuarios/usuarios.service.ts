import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { buildQuery } from '../common/build-query.js';
import { ToggleActivoDto } from './dto/toggle-activo.dto.js';

@Injectable()
export class UsuariosService {
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

  async findAll(
    accessToken: string,
    params: {
      tipo?: string;
      activo?: string;
      q?: string;
      page?: string;
      size?: string;
      sort?: string;
    } = {},
  ) {
    const url = `${this.msUrl}/api/usuarios${buildQuery(params)}`;
    const { data } = await this.httpService.axiosRef.get(url, {
      headers: this.authHeaders(accessToken),
    });
    return data;
  }

  async toggleActivo(id: number, body: ToggleActivoDto, accessToken: string) {
    const { data } = await this.httpService.axiosRef.patch(
      `${this.msUrl}/api/usuarios/${id}/activo`,
      body,
      { headers: this.authHeaders(accessToken) },
    );
    return data;
  }

  /** N15: the Idempotency-Key header is carried to the MS by the shared axios interceptor. */
  async anonimizar(id: number, accessToken: string) {
    const { data } = await this.httpService.axiosRef.post(
      `${this.msUrl}/api/usuarios/${id}/anonimizar`,
      {},
      { headers: this.authHeaders(accessToken) },
    );
    return data;
  }
}
