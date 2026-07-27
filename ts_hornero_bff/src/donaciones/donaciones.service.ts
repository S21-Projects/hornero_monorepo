import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { CrearDonacionDto } from './dto/crear-donacion.dto.js';
import { UpdateEstadoDonacionDto } from './dto/update-estado-donacion.dto.js';

@Injectable()
export class DonacionesService {
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

  async getDonaciones(organizacionId?: string) {
    const url = organizacionId
      ? `${this.msUrl}/api/donaciones?organizacionId=${organizacionId}`
      : `${this.msUrl}/api/donaciones`;
    const { data } = await this.httpService.axiosRef.get(url);
    return data;
  }

  async crear(dto: CrearDonacionDto, accessToken: string) {
    const { data } = await this.httpService.axiosRef.post(
      `${this.msUrl}/api/donaciones`,
      dto,
      { headers: this.authHeaders(accessToken) },
    );
    return data;
  }

  async findById(id: number) {
    const { data } = await this.httpService.axiosRef.get(
      `${this.msUrl}/api/donaciones/${id}`,
    );
    return data;
  }

  async findMias(accessToken: string) {
    const { data } = await this.httpService.axiosRef.get(
      `${this.msUrl}/api/donaciones/mias`,
      { headers: this.authHeaders(accessToken) },
    );
    return data;
  }

  async findDeMiOrganizacion(accessToken: string) {
    const { data } = await this.httpService.axiosRef.get(
      `${this.msUrl}/api/donaciones/mi-organizacion`,
      { headers: this.authHeaders(accessToken) },
    );
    return data;
  }

  async actualizarEstado(id: number, dto: UpdateEstadoDonacionDto, accessToken: string) {
    const { data } = await this.httpService.axiosRef.patch(
      `${this.msUrl}/api/donaciones/${id}/estado`,
      dto,
      { headers: this.authHeaders(accessToken) },
    );
    return data;
  }

  async eliminar(id: number, accessToken: string) {
    const { data } = await this.httpService.axiosRef.delete(
      `${this.msUrl}/api/donaciones/${id}`,
      { headers: this.authHeaders(accessToken) },
    );
    return data;
  }
}
