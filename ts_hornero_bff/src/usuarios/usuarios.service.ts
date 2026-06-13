import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';

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

  async findAll(accessToken: string) {
    const { data } = await this.httpService.axiosRef.get(
      `${this.msUrl}/api/usuarios`,
      { headers: this.authHeaders(accessToken) },
    );
    return data;
  }

  async toggleActivo(id: number, body: object, accessToken: string) {
    const { data } = await this.httpService.axiosRef.patch(
      `${this.msUrl}/api/usuarios/${id}/activo`,
      body,
      { headers: this.authHeaders(accessToken) },
    );
    return data;
  }
}
