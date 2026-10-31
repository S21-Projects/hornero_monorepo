import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import type { Request } from 'express';
import { ConflictException } from '@nestjs/common';
import { THROTTLER_LIMIT } from '@nestjs/throttler/dist/throttler.constants';
import { ClientIpThrottlerGuard } from '../auth/guards/client-ip-throttler.guard';
import { ReclamosService } from '../reclamos/reclamos.service';
import { UploadController } from './upload.controller';
import { UploadService } from './upload.service';
import { OrganizacionesService } from '../organizaciones/organizaciones.service';
import { Role } from '../common/enums/role.enum';
import { AuthService } from '../auth/auth.service';

describe('UploadController', () => {
  let controller: UploadController;
  let uploadService: {
    uploadOrgProfile: jest.Mock;
    uploadOrgBanner: jest.Mock;
    uploadOrgEvidencia: jest.Mock;
    uploadReclamoEvidencia: jest.Mock;
  };
  let authService: { verificarSesion: jest.Mock };
  let reclamosService: { verificarReclamable: jest.Mock };
  let organizacionesService: {
    misOrganizaciones: jest.Mock;
    actualizar: jest.Mock;
    actualizarInfoPublica: jest.Mock;
  };

  const requestWithToken = (token = 'token-123') =>
    ({ cookies: { access_token: token } }) as unknown as Request;

  const requestAsAdmin = (token = 'admin-token') =>
    ({
      cookies: { access_token: token },
      user: { tipo: Role.ADMINISTRADOR },
    }) as unknown as Request;

  // Real MS response shape (ApiResponseAdvice): the list lives under `data`.
  const envelope = (data: unknown) => ({
    status: 200,
    message: 'OK',
    timestamp: '2026-10-30T00:00:00',
    data,
    errors: null,
  });

  const file = { originalname: 'photo.jpg' } as Express.Multer.File;

  beforeEach(async () => {
    uploadService = {
      uploadOrgProfile: jest.fn().mockResolvedValue('org-profile/1-key'),
      uploadOrgBanner: jest.fn().mockResolvedValue('org-banner/1-key'),
      uploadOrgEvidencia: jest.fn().mockResolvedValue('org-evidencia/5/1-key'),
      uploadReclamoEvidencia: jest
        .fn()
        .mockResolvedValue('reclamo-evidencia/5/7/1-key'),
    };
    authService = { verificarSesion: jest.fn().mockResolvedValue({}) };
    reclamosService = {
      verificarReclamable: jest.fn().mockResolvedValue(undefined),
    };
    organizacionesService = {
      misOrganizaciones: jest.fn(),
      actualizar: jest.fn().mockResolvedValue({}),
      actualizarInfoPublica: jest.fn().mockResolvedValue({}),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UploadController],
      providers: [
        { provide: UploadService, useValue: uploadService },
        { provide: OrganizacionesService, useValue: organizacionesService },
        { provide: AuthService, useValue: authService },
        { provide: ReclamosService, useValue: reclamosService },
      ],
    })
      .overrideGuard(ClientIpThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<UploadController>(UploadController);
  });

  describe('assertOwnership (via uploadOrgProfile)', () => {
    it('allows the upload when the org id is present in the envelope-wrapped misOrganizaciones response', async () => {
      organizacionesService.misOrganizaciones.mockResolvedValue(
        envelope([{ id: 2 }, { id: 5 }]),
      );

      const result = await controller.uploadOrgProfile(
        5,
        file,
        requestWithToken(),
      );

      expect(result).toEqual({ key: 'org-profile/1-key' });
    });

    it('still accepts a bare array (tolerated for safety)', async () => {
      organizacionesService.misOrganizaciones.mockResolvedValue([{ id: 5 }]);

      const result = await controller.uploadOrgProfile(
        5,
        file,
        requestWithToken(),
      );

      expect(result).toEqual({ key: 'org-profile/1-key' });
    });

    it('rejects the upload when the org id is not owned by the referente', async () => {
      organizacionesService.misOrganizaciones.mockResolvedValue(
        envelope([{ id: 2 }, { id: 5 }]),
      );

      await expect(
        controller.uploadOrgProfile(99, file, requestWithToken()),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rejects the upload when misOrganizaciones returns an empty array', async () => {
      organizacionesService.misOrganizaciones.mockResolvedValue(envelope([]));

      await expect(
        controller.uploadOrgProfile(5, file, requestWithToken()),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('admin moderation path', () => {
    it('uploads the profile image for any org without checking ownership', async () => {
      const result = await controller.uploadOrgProfile(
        99,
        file,
        requestAsAdmin(),
      );

      expect(organizacionesService.misOrganizaciones).not.toHaveBeenCalled();
      expect(organizacionesService.actualizar).not.toHaveBeenCalled();
      expect(organizacionesService.actualizarInfoPublica).toHaveBeenCalledWith(
        99,
        { profileImageKey: 'org-profile/1-key' },
        'admin-token',
      );
      expect(result).toEqual({ key: 'org-profile/1-key' });
    });

    it('uploads the banner image for any org without checking ownership', async () => {
      const result = await controller.uploadOrgBanner(
        99,
        file,
        requestAsAdmin(),
      );

      expect(organizacionesService.misOrganizaciones).not.toHaveBeenCalled();
      expect(organizacionesService.actualizarInfoPublica).toHaveBeenCalledWith(
        99,
        { bannerKey: 'org-banner/1-key' },
        'admin-token',
      );
      expect(result).toEqual({ key: 'org-banner/1-key' });
    });
  });

  describe('POST upload/org-evidencia/:id', () => {
    it('allows the owning referente to upload', async () => {
      organizacionesService.misOrganizaciones.mockResolvedValue(
        envelope([{ id: 5 }]),
      );

      const result = await controller.uploadOrgEvidencia(
        5,
        file,
        requestWithToken(),
      );

      expect(uploadService.uploadOrgEvidencia).toHaveBeenCalledWith(5, file);
      expect(result).toEqual({ key: 'org-evidencia/5/1-key' });
    });

    it('rejects a non-owning referente', async () => {
      organizacionesService.misOrganizaciones.mockResolvedValue(
        envelope([{ id: 2 }]),
      );

      await expect(
        controller.uploadOrgEvidencia(99, file, requestWithToken()),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(uploadService.uploadOrgEvidencia).not.toHaveBeenCalled();
    });

    it('allows an admin to upload for any organizacion without an ownership check', async () => {
      const result = await controller.uploadOrgEvidencia(
        99,
        file,
        requestAsAdmin(),
      );

      expect(organizacionesService.misOrganizaciones).not.toHaveBeenCalled();
      expect(uploadService.uploadOrgEvidencia).toHaveBeenCalledWith(99, file);
      expect(result).toEqual({ key: 'org-evidencia/5/1-key' });
    });

    it('never persists the key against the organizacion — evidence linking happens via cargarEvidencia', async () => {
      organizacionesService.misOrganizaciones.mockResolvedValue(
        envelope([{ id: 5 }]),
      );

      await controller.uploadOrgEvidencia(5, file, requestWithToken());

      expect(organizacionesService.actualizar).not.toHaveBeenCalled();
      expect(
        organizacionesService.actualizarInfoPublica,
      ).not.toHaveBeenCalled();
    });
  });

  describe('N9: deactivated user is refused before anything is written to S3', () => {
    const inactive = new Error('USUARIO_INACTIVO');

    beforeEach(() => {
      authService.verificarSesion.mockRejectedValue(inactive);
    });

    it.each([
      [
        'org-profile',
        (c: UploadController, r: Request) => c.uploadOrgProfile(1, file, r),
      ],
      [
        'org-banner',
        (c: UploadController, r: Request) => c.uploadOrgBanner(1, file, r),
      ],
      [
        'org-evidencia',
        (c: UploadController, r: Request) => c.uploadOrgEvidencia(1, file, r),
      ],
    ])(
      '%s: admin token of an inactive user is rejected, nothing uploaded',
      async (_n, call) => {
        await expect(call(controller, requestAsAdmin())).rejects.toBe(inactive);

        expect(authService.verificarSesion).toHaveBeenCalledWith('admin-token');
        expect(uploadService.uploadOrgProfile).not.toHaveBeenCalled();
        expect(uploadService.uploadOrgBanner).not.toHaveBeenCalled();
        expect(uploadService.uploadOrgEvidencia).not.toHaveBeenCalled();
      },
    );
  });
  describe('uploadReclamoEvidencia', () => {
    const asReferente = (userId = '7') =>
      ({
        cookies: { access_token: 'token-123' },
        user: { tipo: Role.REFERENTE, userId },
      }) as unknown as Request;

    it('stores under the caller own prefix without an ownership check (the org is unclaimed)', async () => {
      const result = await controller.uploadReclamoEvidencia(
        5,
        file,
        asReferente(),
      );

      expect(result).toEqual({ key: 'reclamo-evidencia/5/7/1-key' });
      expect(authService.verificarSesion).toHaveBeenCalledWith('token-123');
      expect(uploadService.uploadReclamoEvidencia).toHaveBeenCalledWith(
        5,
        7,
        file,
      );
      expect(organizacionesService.misOrganizaciones).not.toHaveBeenCalled();
    });

    it('checks with the MS that the organizacion is claimable before writing anything', async () => {
      await controller.uploadReclamoEvidencia(5, file, asReferente());

      expect(reclamosService.verificarReclamable).toHaveBeenCalledWith(
        5,
        'token-123',
      );
      expect(
        reclamosService.verificarReclamable.mock.invocationCallOrder[0],
      ).toBeLessThan(
        uploadService.uploadReclamoEvidencia.mock.invocationCallOrder[0],
      );
    });

    it('never writes to storage when the MS refuses the claim (404/409)', async () => {
      reclamosService.verificarReclamable.mockRejectedValue(
        new ConflictException(),
      );

      await expect(
        controller.uploadReclamoEvidencia(5, file, asReferente()),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(uploadService.uploadReclamoEvidencia).not.toHaveBeenCalled();
    });

    it('is rate limited per client IP (10 uploads per minute)', () => {
      const handler = UploadController.prototype.uploadReclamoEvidencia;
      expect(Reflect.getMetadata(THROTTLER_LIMIT + 'default', handler)).toBe(
        10,
      );
      const guards = Reflect.getMetadata('__guards__', handler) as unknown[];
      expect(guards.map((g) => (g as { name: string }).name)).toContain(
        'ClientIpThrottlerGuard',
      );
    });

    it('rejects a missing file and never writes', async () => {
      await expect(
        controller.uploadReclamoEvidencia(
          5,
          undefined as unknown as Express.Multer.File,
          asReferente(),
        ),
      ).rejects.toThrow();
      expect(uploadService.uploadReclamoEvidencia).not.toHaveBeenCalled();
    });

    it('rejects a session without a usable user id', async () => {
      await expect(
        controller.uploadReclamoEvidencia(5, file, asReferente('abc')),
      ).rejects.toThrow();
      expect(uploadService.uploadReclamoEvidencia).not.toHaveBeenCalled();
    });
  });
});
