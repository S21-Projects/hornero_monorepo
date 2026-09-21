import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { Readable } from 'stream';
import type { Request, Response } from 'express';
import { EvidenciaFilesController } from './evidencia-files.controller';
import { ImagesService } from '../images/images.service.js';
import { OrganizacionesService } from '../organizaciones/organizaciones.service.js';
import { Role } from '../common/enums/role.enum.js';

/**
 * specs/organizacion-evidencia/spec.md — "Authenticated Evidence-File Access": the owning
 * REFERENTE and any ADMINISTRADOR may fetch an evidence file; a non-owning REFERENTE is denied
 * `403`. This route is the only supported way to read an `org-evidencia/` object — the public
 * `GET /images?key=` route keeps rejecting that prefix unconditionally (A3 deny-list, untouched).
 */
describe('EvidenciaFilesController', () => {
  let controller: EvidenciaFilesController;
  let imagesService: { getObject: jest.Mock };
  let organizacionesService: { misOrganizaciones: jest.Mock };

  const requestAsReferente = (token = 'token-123') =>
    ({
      cookies: { access_token: token },
      user: { tipo: Role.REFERENTE },
    }) as unknown as Request;

  const requestAsAdmin = (token = 'admin-token') =>
    ({
      cookies: { access_token: token },
      user: { tipo: Role.ADMINISTRADOR },
    }) as unknown as Request;

  const fakeResponse = () => ({ set: jest.fn() }) as unknown as Response;

  beforeEach(async () => {
    imagesService = {
      getObject: jest.fn().mockResolvedValue({
        body: Readable.from([Buffer.from('fake-photo')]),
        contentType: 'image/jpeg',
      }),
    };
    organizacionesService = { misOrganizaciones: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [EvidenciaFilesController],
      providers: [
        { provide: ImagesService, useValue: imagesService },
        { provide: OrganizacionesService, useValue: organizacionesService },
      ],
    }).compile();

    controller = module.get<EvidenciaFilesController>(EvidenciaFilesController);
  });

  it('lets the owning REFERENTE fetch their own organizacion evidence file', async () => {
    organizacionesService.misOrganizaciones.mockResolvedValue([{ id: 5 }]);

    await controller.serve(5, 'foto.jpg', requestAsReferente(), fakeResponse());

    expect(imagesService.getObject).toHaveBeenCalledWith(
      'org-evidencia/5/foto.jpg',
    );
  });

  it('lets an ADMINISTRADOR fetch any organizacion evidence file without an ownership check', async () => {
    await controller.serve(99, 'foto.jpg', requestAsAdmin(), fakeResponse());

    expect(organizacionesService.misOrganizaciones).not.toHaveBeenCalled();
    expect(imagesService.getObject).toHaveBeenCalledWith(
      'org-evidencia/99/foto.jpg',
    );
  });

  it('denies a non-owning REFERENTE with 403', async () => {
    organizacionesService.misOrganizaciones.mockResolvedValue([{ id: 2 }]);

    await expect(
      controller.serve(99, 'foto.jpg', requestAsReferente(), fakeResponse()),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(imagesService.getObject).not.toHaveBeenCalled();
  });

  it('denies a REFERENTE who owns no organizaciones at all', async () => {
    organizacionesService.misOrganizaciones.mockResolvedValue([]);

    await expect(
      controller.serve(5, 'foto.jpg', requestAsReferente(), fakeResponse()),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(imagesService.getObject).not.toHaveBeenCalled();
  });
});
