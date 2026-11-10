import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) => req?.cookies?.access_token ?? null,
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') as string,
    });
  }

  async validate(payload: any) {
    // Only access tokens authenticate requests; a refresh token in this cookie is rejected.
    if (payload?.type !== 'access') {
      throw new UnauthorizedException();
    }
    return {
      userId: payload.sub,
      email: payload.email,
      nombre: payload.nombre,
      tipo: payload.tipo,
      emailVerificado: payload.emailVerificado,
    };
  }
}
