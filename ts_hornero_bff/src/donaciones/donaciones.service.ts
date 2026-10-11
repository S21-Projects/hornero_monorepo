import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { buildQuery } from '../common/build-query.js';
import { CrearDonacionDto } from './dto/crear-donacion.dto.js';
import { DecisionDonacionDto } from './dto/decision-donacion.dto.js';
import { OverrideEstadoDto } from './dto/override-estado.dto.js';
import { UpdateEstadoDonacionDto } from './dto/update-estado-donacion.dto.js';
import { VerificarCodigoDto } from './dto/verificar-codigo.dto.js';

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

  // Public reads: the MS masks the donor identity unless the caller is allowed to see it, so
  // the session token rides along when there is one. Anonymous callers send no header.
  private optionalAuthHeaders(accessToken?: string) {
    return accessToken ? this.authHeaders(accessToken) : {};
  }

  async getDonaciones(
    organizacionId?: string,
    page?: string,
    size?: string,
    sort?: string,
    accessToken?: string,
  ) {
    const url = `${this.msUrl}/api/donaciones${buildQuery({ organizacionId, page, size, sort })}`;
    const { data } = await this.httpService.axiosRef.get(url, {
      headers: this.optionalAuthHeaders(accessToken),
    });
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

  async findById(id: number, accessToken?: string) {
    const { data } = await this.httpService.axiosRef.get(
      `${this.msUrl}/api/donaciones/${id}`,
      { headers: this.optionalAuthHeaders(accessToken) },
    );
    return data;
  }

  async findMias(
    accessToken: string,
    page?: string,
    size?: string,
    sort?: string,
  ) {
    const url = `${this.msUrl}/api/donaciones/mias${buildQuery({ page, size, sort })}`;
    const { data } = await this.httpService.axiosRef.get(url, {
      headers: this.authHeaders(accessToken),
    });
    return data;
  }

  async findDeMiOrganizacion(accessToken: string, organizacionId?: string) {
    const url = organizacionId
      ? `${this.msUrl}/api/donaciones/mi-organizacion?organizacionId=${organizacionId}`
      : `${this.msUrl}/api/donaciones/mi-organizacion`;
    const { data } = await this.httpService.axiosRef.get(url, {
      headers: this.authHeaders(accessToken),
    });
    return data;
  }

  async actualizarEstado(
    id: number,
    dto: UpdateEstadoDonacionDto,
    accessToken: string,
  ) {
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

  async decidir(id: number, dto: DecisionDonacionDto, accessToken: string) {
    const { data } = await this.httpService.axiosRef.patch(
      `${this.msUrl}/api/donaciones/${id}/decision`,
      dto,
      { headers: this.authHeaders(accessToken) },
    );
    return data;
  }

  async overrideEstado(
    id: number,
    dto: OverrideEstadoDto,
    accessToken: string,
  ) {
    const { data } = await this.httpService.axiosRef.patch(
      `${this.msUrl}/api/donaciones/${id}/estado-admin`,
      dto,
      { headers: this.authHeaders(accessToken) },
    );
    return data;
  }

  async generarCodigoEntrega(id: number, accessToken: string) {
    const { data } = await this.httpService.axiosRef.post(
      `${this.msUrl}/api/donaciones/${id}/entrega/codigo`,
      null,
      { headers: this.authHeaders(accessToken) },
    );
    return data;
  }

  async verificarCodigoEntrega(
    id: number,
    dto: VerificarCodigoDto,
    accessToken: string,
  ) {
    const { data } = await this.httpService.axiosRef.post(
      `${this.msUrl}/api/donaciones/${id}/entrega/verificar`,
      dto,
      { headers: this.authHeaders(accessToken) },
    );
    return data;
  }

  async estadoEntrega(id: number, accessToken: string) {
    const { data } = await this.httpService.axiosRef.get(
      `${this.msUrl}/api/donaciones/${id}/entrega`,
      { headers: this.authHeaders(accessToken) },
    );
    return data;
  }

  async asignaciones(id: number, accessToken: string) {
    const { data } = await this.httpService.axiosRef.get(
      `${this.msUrl}/api/donaciones/${id}/asignaciones`,
      { headers: this.authHeaders(accessToken) },
    );
    return data;
  }

  async findActivas(
    accessToken: string,
    page?: string,
    size?: string,
    sort?: string,
    q?: string,
    estado?: string,
  ) {
    const url = `${this.msUrl}/api/donaciones/activas${buildQuery({ page, size, sort, q, estado })}`;
    const { data } = await this.httpService.axiosRef.get(url, {
      headers: this.authHeaders(accessToken),
    });
    return data;
  }
}
