import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Readable } from 'stream';
import type { Request, Response } from 'express';
import { EvidenciaFilesController } from './evidencia-files.controller';
import { ImagesService } from '../images/images.service.js';
import { AcreditacionService } from '../acreditacion/acreditacion.service.js';
import { Role } from '../common/enums/role.enum.js';

/**
 * AD-12 (tesis-core-features slice 2): `EvidenciaFilesController` now delegates the whole
 * authorization decision — ownership AND row binding — to the MS through
 * `AcreditacionService.verificarArchivoEvidencia`, for every role (no more BFF-side
 * `misOrganizaciones` ownership shortcut for admins, and no bypass for anyone).
 */
describe('EvidenciaFilesController', () => {
  let controller: EvidenciaFilesController;
  let imagesService: { getObject: jest.Mock };
  let acreditacionService: { verificarArchivoEvidencia: jest.Mock };

  const requestWith = (token = 'token-123', tipo: Role = Role.REFERENTE) =>
    ({
      cookies: { access_token: token },
      user: { tipo },
    }) as unknown as Request;

  // Returns the bare `set` mock alongside the Response so assertions don't reference an unbound method.
  const fakeResponse = () => {
    const set = jest.fn();
    return { response: { set } as unknown as Response, set };
  };

  beforeEach(async () => {
    imagesService = {
      getObject: jest.fn().mockResolvedValue({
        body: Readable.from([Buffer.from('fake-photo')]),
        contentType: 'image/jpeg',
      }),
    };
    acreditacionService = {
      verificarArchivoEvidencia: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [EvidenciaFilesController],
      providers: [
        { provide: ImagesService, useValue: imagesService },
        { provide: AcreditacionService, useValue: acreditacionService },
      ],
    }).compile();

    controller = module.get<EvidenciaFilesController>(EvidenciaFilesController);
  });

  it('serves a PDF inline with nosniff', async () => {
    imagesService.getObject.mockResolvedValue({
      body: Readable.from([Buffer.from('%PDF-1.7')]),
      contentType: 'application/pdf',
    });
    const { response, set } = fakeResponse();
    await controller.serve(5, 'doc.pdf', requestWith(), response);

    expect(set).toHaveBeenCalledWith('Content-Type', 'application/pdf');
    expect(set).toHaveBeenCalledWith('Content-Disposition', 'inline');
    expect(set).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
  });

  it('streams the object when the MS confirms the row (204)', async () => {
    const { response, set } = fakeResponse();
    await controller.serve(
      5,
      'foto.jpg',
      requestWith('token-123', Role.REFERENTE),
      response,
    );

    // Accreditation evidence: never stored by the browser or Cloudflare.
    expect(set).toHaveBeenCalledWith('Cache-Control', 'private, no-store');

    expect(acreditacionService.verificarArchivoEvidencia).toHaveBeenCalledWith(
      5,
      'org-evidencia/5/foto.jpg',
      'token-123',
    );
    expect(imagesService.getObject).toHaveBeenCalledWith(
      'org-evidencia/5/foto.jpg',
    );
  });

  it('also goes through the MS check for an ADMINISTRADOR (no bypass)', async () => {
    await controller.serve(
      99,
      'foto.jpg',
      requestWith('admin-token', Role.ADMINISTRADOR),
      fakeResponse(),
    );

    expect(acreditacionService.verificarArchivoEvidencia).toHaveBeenCalledWith(
      99,
      'org-evidencia/99/foto.jpg',
      'admin-token',
    );
    expect(imagesService.getObject).toHaveBeenCalledWith(
      'org-evidencia/99/foto.jpg',
    );
  });

  it('propagates a ForbiddenException from the MS check and never calls getObject', async () => {
    acreditacionService.verificarArchivoEvidencia.mockRejectedValueOnce(
      new ForbiddenException('No autorizado'),
    );

    await expect(
      controller.serve(99, 'foto.jpg', requestWith(), fakeResponse()),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(imagesService.getObject).not.toHaveBeenCalled();
  });

  it('propagates a NotFoundException from the MS check and never calls getObject', async () => {
    acreditacionService.verificarArchivoEvidencia.mockRejectedValueOnce(
      new NotFoundException('Evidencia no encontrada'),
    );

    await expect(
      controller.serve(5, 'no-existe.jpg', requestWith(), fakeResponse()),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(imagesService.getObject).not.toHaveBeenCalled();
  });
});
