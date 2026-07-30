import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { buildQuery } from '../common/build-query.js';
import { CrearNecesidadDto } from './dto/crear-necesidad.dto.js';
import { ActualizarNecesidadDto } from './dto/actualizar-necesidad.dto.js';

@Injectable()
export class NecesidadesService {
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

  async getNecesidades(
    organizacionId?: string,
    page?: string,
    size?: string,
    sort?: string,
  ) {
    const url = `${this.msUrl}/api/necesidades${buildQuery({ organizacionId, page, size, sort })}`;
    const { data } = await this.httpService.axiosRef.get(url);
    return data;
  }

  async crear(dto: CrearNecesidadDto, accessToken: string) {
    const { data } = await this.httpService.axiosRef.post(
      `${this.msUrl}/api/necesidades`,
      dto,
      { headers: this.authHeaders(accessToken) },
    );
    return data;
  }

  async findById(id: number) {
    const { data } = await this.httpService.axiosRef.get(
      `${this.msUrl}/api/necesidades/${id}`,
    );
    return data;
  }

  async actualizar(
    id: number,
    dto: ActualizarNecesidadDto,
    accessToken: string,
  ) {
    const { data } = await this.httpService.axiosRef.patch(
      `${this.msUrl}/api/necesidades/${id}`,
      dto,
      { headers: this.authHeaders(accessToken) },
    );
    return data;
  }

  async eliminar(id: number, accessToken: string) {
    const { data } = await this.httpService.axiosRef.delete(
      `${this.msUrl}/api/necesidades/${id}`,
      { headers: this.authHeaders(accessToken) },
    );
    return data;
  }
}
