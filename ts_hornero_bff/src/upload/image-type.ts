import { BadRequestException } from '@nestjs/common';
import type { FileFilterCallback } from 'multer';

export interface DetectedImageType {
  mimetype: 'image/jpeg' | 'image/png' | 'image/webp';
  ext: 'jpg' | 'png' | 'webp';
}

const startsWith = (buffer: Buffer, offset: number, bytes: number[]) =>
  buffer.length >= offset + bytes.length &&
  bytes.every((byte, i) => buffer[offset + i] === byte);

/**
 * Identifies an allowed image (JPEG, PNG, WebP) by its leading magic bytes. The client-supplied
 * mimetype and filename are never consulted: they are attacker-controlled.
 */
export function detectImageType(
  buffer: Buffer | undefined,
): DetectedImageType | null {
  if (!buffer) return null;

  if (startsWith(buffer, 0, [0xff, 0xd8, 0xff])) {
    return { mimetype: 'image/jpeg', ext: 'jpg' };
  }
  if (startsWith(buffer, 0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return { mimetype: 'image/png', ext: 'png' };
  }
  // WebP: "RIFF" <4-byte size> "WEBP"
  if (
    startsWith(buffer, 0, [0x52, 0x49, 0x46, 0x46]) &&
    startsWith(buffer, 8, [0x57, 0x45, 0x42, 0x50])
  ) {
    return { mimetype: 'image/webp', ext: 'webp' };
  }
  return null;
}

export interface DetectedEvidenceType {
  mimetype: 'image/jpeg' | 'image/png' | 'application/pdf';
  ext: 'jpg' | 'png' | 'pdf';
}

/**
 * Accreditation evidence accepts exactly JPEG, PNG and PDF (the `%PDF-` header). WebP is not
 * allowed here even though banners and profile images still take it. Used only by the evidence
 * upload path.
 */
export function detectEvidenceType(
  buffer: Buffer | undefined,
): DetectedEvidenceType | null {
  if (!buffer) return null;
  if (startsWith(buffer, 0, [0x25, 0x50, 0x44, 0x46, 0x2d])) {
    return { mimetype: 'application/pdf', ext: 'pdf' };
  }
  const image = detectImageType(buffer);
  if (!image || image.ext === 'webp') return null;
  return image as DetectedEvidenceType;
}

const ALLOWED_MIMETYPES = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * Cheap first gate on the client-declared mimetype, so obviously wrong uploads fail with a clear
 * 400 before being buffered. The real check is `detectImageType` on the content.
 */
export function imageMimeFilter(
  _req: unknown,
  file: Express.Multer.File,
  cb: FileFilterCallback,
): void {
  if (ALLOWED_MIMETYPES.includes(file.mimetype)) {
    cb(null, true);
    return;
  }
  cb(
    new BadRequestException(
      'Unsupported file type (jpeg, png, or webp images only)',
    ),
  );
}

const EVIDENCE_MIMETYPES = ['image/jpeg', 'image/png', 'application/pdf'];

/** Accreditation evidence filter: JPEG, PNG or PDF only (no WebP). */
export function evidenceMimeFilter(
  _req: unknown,
  file: Express.Multer.File,
  cb: FileFilterCallback,
): void {
  if (EVIDENCE_MIMETYPES.includes(file.mimetype)) {
    cb(null, true);
    return;
  }
  cb(new BadRequestException('Unsupported file type (jpeg, png, or pdf only)'));
}
