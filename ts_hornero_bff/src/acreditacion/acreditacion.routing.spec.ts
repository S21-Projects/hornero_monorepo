import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import request from 'supertest';
import type { App } from 'supertest/types';
import type { NextFunction, Request, Response } from 'express';
import { OrganizacionesModule } from '../organizaciones/organizaciones.module';
import { OrganizacionesService } from '../organizaciones/organizaciones.service';
import { AcreditacionModule } from './acreditacion.module';
import { AcreditacionService } from './acreditacion.service';

/**
 * Threat Matrix "BFF route shadowing" row: `GET /organizaciones/:slug`
 * (`organizaciones.controller.ts` — single path segment) must never intercept the new
 * two-segment `GET /organizaciones/:id/acreditacion` path. Guards are stubbed to always allow so
 * this test isolates routing resolution, not auth.
 */
describe('BFF route shadowing — organizaciones/:slug vs organizaciones/:id/acreditacion', () => {
  let app: INestApplication<App>;
  let organizacionesService: { findBySlug: jest.Mock };
  let acreditacionService: { acreditacion: jest.Mock };

  beforeEach(async () => {
    organizacionesService = { findBySlug: jest.fn() };
    acreditacionService = {
      acreditacion: jest
        .fn()
        .mockResolvedValue({ organizacionId: 1, nivel: 'N1' }),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [OrganizacionesModule, AcreditacionModule],
      providers: [
        { provide: APP_GUARD, useValue: { canActivate: () => true } },
      ],
    })
      .overrideProvider(OrganizacionesService)
      .useValue(organizacionesService)
      .overrideProvider(AcreditacionService)
      .useValue(acreditacionService)
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

  it('resolves the two-segment acreditacion route to AcreditacionController, not findBySlug', async () => {
    const response = await request(app.getHttpServer())
      .get('/organizaciones/1/acreditacion')
      .expect(200);

    expect(response.body).toEqual({ organizacionId: 1, nivel: 'N1' });
    expect(acreditacionService.acreditacion).toHaveBeenCalledWith(
      1,
      'token-123',
    );
    expect(organizacionesService.findBySlug).not.toHaveBeenCalled();
  });

  it('still resolves the single-segment slug route to findBySlug', async () => {
    organizacionesService.findBySlug.mockResolvedValue({
      id: 1,
      slug: 'acreditacion',
    });

    await request(app.getHttpServer())
      .get('/organizaciones/acreditacion')
      .expect(200);

    expect(organizacionesService.findBySlug).toHaveBeenCalledWith(
      'acreditacion',
    );
    expect(acreditacionService.acreditacion).not.toHaveBeenCalled();
  });
});
