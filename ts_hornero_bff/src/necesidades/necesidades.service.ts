import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { CrearNecesidadDto } from './dto/crear-necesidad.dto.js';

@Injectable()
export class NecesidadesService {
  constructor(
    private httpService: HttpService,
    private configService: ConfigService,
  ) {}

  private get msUrl(): string {
    return this.configService.get<string>('JAVA_MS_URL') as string;
  }

  async getNecesidades(organizacionId?: string) {
    const url = organizacionId
      ? `${this.msUrl}/api/necesidades?organizacionId=${organizacionId}`
      : `${this.msUrl}/api/necesidades`;
    const { data } = await this.httpService.axiosRef.get(url);
    return data;
  }

  async crear(dto: CrearNecesidadDto, accessToken: string) {
    const { data } = await this.httpService.axiosRef.post(
      `${this.msUrl}/api/necesidades`,
      dto,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    return data;
  }
}
