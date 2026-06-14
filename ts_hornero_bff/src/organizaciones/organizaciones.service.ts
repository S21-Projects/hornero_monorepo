import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { CrearOrganizacionDto } from './dto/crear-organizacion.dto.js';

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

  async miOrganizacion(accessToken: string) {
    const { data } = await this.httpService.axiosRef.get(
      `${this.msUrl}/api/organizaciones/mia`,
      { headers: this.authHeaders(accessToken) },
    );
    return data;
  }

  async listarValidadas(accessToken?: string) {
    const url = `${this.msUrl}/api/organizaciones`;
    try {
      const { data } = await this.httpService.axiosRef.get(
        url,
        accessToken ? { headers: this.authHeaders(accessToken) } : {},
      );
      return data;
    } catch (err: any) {
      const status = err?.response?.status;
      const body = JSON.stringify(err?.response?.data);
      throw new Error(`MS ${status} on GET ${url}: ${body}`);
    }
  }

  async listarPendientes(accessToken: string) {
    const { data } = await this.httpService.axiosRef.get(
      `${this.msUrl}/api/organizaciones/pendientes`,
      { headers: this.authHeaders(accessToken) },
    );
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
}
