import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class DonacionesService {
  constructor(
    private httpService: HttpService,
    private configService: ConfigService,
  ) {}

  private get msUrl(): string {
    return this.configService.get<string>('JAVA_MS_URL') as string;
  }

  async getDonaciones(organizacionId?: string) {
    const url = organizacionId
      ? `${this.msUrl}/api/donaciones?organizacionId=${organizacionId}`
      : `${this.msUrl}/api/donaciones`;
    const { data } = await this.httpService.axiosRef.get(url);
    return data;
  }
}
