import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { buildQuery } from '../common/build-query.js';
import { CrearOrganizacionDto } from './dto/crear-organizacion.dto.js';
import { ActualizarOrganizacionDto } from './dto/actualizar-organizacion.dto.js';
import { ActualizarInfoPublicaDto } from './dto/actualizar-info-publica.dto.js';
import { AsignarReferenteDto } from './dto/asignar-referente.dto.js';

@Injectable()
export class OrganizacionesService {
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

  async crear(dto: CrearOrganizacionDto, accessToken: string) {
    const { data } = await this.httpService.axiosRef.post(
      `${this.msUrl}/api/organizaciones`,
      dto,
      { headers: this.authHeaders(accessToken) },
    );
    return data;
  }

  async misOrganizaciones(accessToken: string) {
    const { data } = await this.httpService.axiosRef.get(
      `${this.msUrl}/api/organizaciones/mia`,
      { headers: this.authHeaders(accessToken) },
    );
    return data;
  }

  async listarTodas(accessToken: string) {
    const { data } = await this.httpService.axiosRef.get(
      `${this.msUrl}/api/organizaciones/todas`,
      { headers: this.authHeaders(accessToken) },
    );
    return data;
  }

  async asignarReferente(
    id: number,
    dto: AsignarReferenteDto,
    accessToken: string,
  ) {
    const { data } = await this.httpService.axiosRef.patch(
      `${this.msUrl}/api/organizaciones/${id}/referente`,
      dto,
      { headers: this.authHeaders(accessToken) },
    );
    return data;
  }

  async listarValidadas(accessToken?: string, page?: string, size?: string, sort?: string) {
    const url = `${this.msUrl}/api/organizaciones${buildQuery({ page, size, sort })}`;
    const { data } = await this.httpService.axiosRef.get(
      url,
      accessToken ? { headers: this.authHeaders(accessToken) } : {},
    );
    return data;
  }

  async listarPendientes(accessToken: string, page?: string, size?: string, sort?: string) {
    const url = `${this.msUrl}/api/organizaciones/pendientes${buildQuery({ page, size, sort })}`;
    const { data } = await this.httpService.axiosRef.get(url, {
      headers: this.authHeaders(accessToken),
    });
    return data;
  }

  async findBySlug(slug: string) {
    const { data } = await this.httpService.axiosRef.get(
      `${this.msUrl}/api/organizaciones/${slug}`,
    );
    return data;
  }

  async validar(id: number, accessToken: string) {
    const { data } = await this.httpService.axiosRef.patch(
      `${this.msUrl}/api/organizaciones/${id}/validar`,
      {},
      { headers: this.authHeaders(accessToken) },
    );
    return data;
  }

  async rechazar(id: number, accessToken: string) {
    const { data } = await this.httpService.axiosRef.patch(
      `${this.msUrl}/api/organizaciones/${id}/rechazar`,
      {},
      { headers: this.authHeaders(accessToken) },
    );
    return data;
  }

  async actualizar(
    id: number,
    dto: ActualizarOrganizacionDto,
    accessToken: string,
  ) {
    const { data } = await this.httpService.axiosRef.patch(
      `${this.msUrl}/api/organizaciones/${id}`,
      dto,
      { headers: this.authHeaders(accessToken) },
    );
    return data;
  }

  async actualizarInfoPublica(
    id: number,
    dto: ActualizarInfoPublicaDto,
    accessToken: string,
  ) {
    const { data } = await this.httpService.axiosRef.patch(
      `${this.msUrl}/api/organizaciones/${id}/info-publica`,
      dto,
      { headers: this.authHeaders(accessToken) },
    );
    return data;
  }

  async aprobarInfoPublica(id: number, accessToken: string) {
    const { data } = await this.httpService.axiosRef.patch(
      `${this.msUrl}/api/organizaciones/${id}/info-publica/aprobar`,
      {},
      { headers: this.authHeaders(accessToken) },
    );
    return data;
  }

  async rechazarInfoPublica(id: number, accessToken: string) {
    const { data } = await this.httpService.axiosRef.patch(
      `${this.msUrl}/api/organizaciones/${id}/info-publica/rechazar`,
      {},
      { headers: this.authHeaders(accessToken) },
    );
    return data;
  }
}
