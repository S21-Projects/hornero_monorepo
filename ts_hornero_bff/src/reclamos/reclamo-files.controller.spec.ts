import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Readable } from 'stream';
import type { Request, Response } from 'express';
import { ReclamoFilesController } from './reclamo-files.controller';
import { ReclamosService } from './reclamos.service';
import { ImagesService } from '../images/images.service.js';

describe('ReclamoFilesController', () => {
  let controller: ReclamoFilesController;
  let imagesService: { getObject: jest.Mock };
  let reclamosService: { verificarArchivo: jest.Mock };

  const req = (token: string | null = 'token-123') =>
    ({ cookies: token ? { access_token: token } : {} }) as unknown as Request;
  const res = () => ({ set: jest.fn() }) as unknown as Response;

  beforeEach(async () => {
    imagesService = {
      getObject: jest.fn().mockResolvedValue({
        body: Readable.from([Buffer.from('x')]),
        contentType: 'image/jpeg',
      }),
    };
    reclamosService = {
      verificarArchivo: jest.fn().mockResolvedValue(undefined),
    };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReclamoFilesController],
      providers: [
        { provide: ImagesService, useValue: imagesService },
        { provide: ReclamosService, useValue: reclamosService },
      ],
    }).compile();
    controller = module.get(ReclamoFilesController);
  });

  it('authorizes with the MS, then streams the bound key', async () => {
    const response = res();
    await controller.serve(4, 7, 'foto.jpg', req(), response);

    // Personal evidence: never stored by the browser or Cloudflare.
    expect(response.set).toHaveBeenCalledWith('Cache-Control', 'private, no-store');

    expect(reclamosService.verificarArchivo).toHaveBeenCalledWith(
      4,
      7,
      'reclamo-evidencia/4/7/foto.jpg',
      'token-123',
    );
    expect(imagesService.getObject).toHaveBeenCalledWith(
      'reclamo-evidencia/4/7/foto.jpg',
    );
  });

  it('never reads storage when the MS refuses', async () => {
    reclamosService.verificarArchivo.mockRejectedValue(
      new ForbiddenException(),
    );

    await expect(
      controller.serve(4, 7, 'foto.jpg', req(), res()),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(imagesService.getObject).not.toHaveBeenCalled();
  });

  it('requires the access_token cookie', async () => {
    await expect(
      controller.serve(4, 7, 'foto.jpg', req(null), res()),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(reclamosService.verificarArchivo).not.toHaveBeenCalled();
  });
});
