import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import request from 'supertest';
import type { App } from 'supertest/types';
import type { NextFunction, Request, Response } from 'express';
import { DonacionesModule } from './donaciones.module';
import { DonacionesService } from './donaciones.service';

/**
 * Task 3c.18/3c.20 — retirement of the plain `confirmar-entrega` route. Spec
 * `donacion-entrega-codigo`'s "Old confirm endpoint no longer exists": a request to the retired
 * route fails (404/405), with no code path resolving to the retired handler. The guard is
 * stubbed to always allow so this isolates routing resolution, not auth — mirrors the precedent
 * in `acreditacion.routing.spec.ts`.
 */
describe('BFF route retirement — POST /donaciones/:id/confirmar-entrega', () => {
  let app: INestApplication<App>;
  let service: { generarCodigoEntrega: jest.Mock };

  beforeEach(async () => {
    service = { generarCodigoEntrega: jest.fn() };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [DonacionesModule],
      providers: [
        { provide: APP_GUARD, useValue: { canActivate: () => true } },
      ],
    })
      .overrideProvider(DonacionesService)
      .useValue(service)
      .compile();

    app = moduleFixture.createNestApplication();
    app.use((req: Request, _res: Response, next: NextFunction) => {
      req.cookies = { access_token: 'token-123' };
      next();
    });
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('no longer resolves the retired route (404)', async () => {
    await request(app.getHttpServer())
      .post('/donaciones/1/confirmar-entrega')
      .expect(404);
  });
});
