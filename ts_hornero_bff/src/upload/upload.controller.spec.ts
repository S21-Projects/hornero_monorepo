import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import type { Request } from 'express';
import { UploadController } from './upload.controller';
import { UploadService } from './upload.service';
import { OrganizacionesService } from '../organizaciones/organizaciones.service';
import { Role } from '../common/enums/role.enum';

describe('UploadController', () => {
  let controller: UploadController;
  let uploadService: {
    uploadOrgProfile: jest.Mock;
    uploadOrgBanner: jest.Mock;
    uploadOrgEvidencia: jest.Mock;
  };
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

  const file = { originalname: 'photo.jpg' } as Express.Multer.File;

  beforeEach(async () => {
    uploadService = {
      uploadOrgProfile: jest.fn().mockResolvedValue('org-profile/1-key'),
      uploadOrgBanner: jest.fn().mockResolvedValue('org-banner/1-key'),
      uploadOrgEvidencia: jest.fn().mockResolvedValue('org-evidencia/5/1-key'),
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
      ],
    }).compile();

    controller = module.get<UploadController>(UploadController);
  });

  describe('assertOwnership (via uploadOrgProfile)', () => {
    it('allows the upload when the org id is present in the misOrganizaciones array', async () => {
      organizacionesService.misOrganizaciones.mockResolvedValue([
        { id: 2 },
        { id: 5 },
      ]);

      const result = await controller.uploadOrgProfile(
        5,
        file,
        requestWithToken(),
      );

      expect(result).toEqual({ key: 'org-profile/1-key' });
    });

    it('rejects the upload when the org id is not owned by the referente', async () => {
      organizacionesService.misOrganizaciones.mockResolvedValue([
        { id: 2 },
        { id: 5 },
      ]);

      await expect(
        controller.uploadOrgProfile(99, file, requestWithToken()),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rejects the upload when misOrganizaciones returns an empty array', async () => {
      organizacionesService.misOrganizaciones.mockResolvedValue([]);

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
      organizacionesService.misOrganizaciones.mockResolvedValue([{ id: 5 }]);

      const result = await controller.uploadOrgEvidencia(
        5,
        file,
        requestWithToken(),
      );

      expect(uploadService.uploadOrgEvidencia).toHaveBeenCalledWith(5, file);
      expect(result).toEqual({ key: 'org-evidencia/5/1-key' });
    });

    it('rejects a non-owning referente', async () => {
      organizacionesService.misOrganizaciones.mockResolvedValue([{ id: 2 }]);

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
      organizacionesService.misOrganizaciones.mockResolvedValue([{ id: 5 }]);

      await controller.uploadOrgEvidencia(5, file, requestWithToken());

      expect(organizacionesService.actualizar).not.toHaveBeenCalled();
      expect(
        organizacionesService.actualizarInfoPublica,
      ).not.toHaveBeenCalled();
    });
  });
});
