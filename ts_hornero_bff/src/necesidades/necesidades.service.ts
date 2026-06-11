import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';

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
    try {
      const { data } = await this.httpService.axiosRef.get(url);
      return data;
    } catch (err: any) {
      const status = err?.response?.status;
      const body = JSON.stringify(err?.response?.data);
      throw new Error(`MS ${status} on GET ${url}: ${body}`);
    }
  }
}
