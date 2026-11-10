import { BadRequestException } from '@nestjs/common';
import {
  detectEvidenceType,
  detectImageType,
  evidenceMimeFilter,
  imageMimeFilter,
} from './image-type';

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
const WEBP = Buffer.concat([
  Buffer.from('RIFF'),
  Buffer.from([0x24, 0x00, 0x00, 0x00]),
  Buffer.from('WEBPVP8 '),
]);

describe('detectImageType', () => {
  it('detects JPEG', () => {
    expect(detectImageType(JPEG)).toEqual({
      mimetype: 'image/jpeg',
      ext: 'jpg',
    });
  });

  it('detects PNG', () => {
    expect(detectImageType(PNG)).toEqual({ mimetype: 'image/png', ext: 'png' });
  });

  it('detects WebP', () => {
    expect(detectImageType(WEBP)).toEqual({
      mimetype: 'image/webp',
      ext: 'webp',
    });
  });

  it('rejects text pretending to be a PNG', () => {
    expect(
      detectImageType(Buffer.from('<script>alert(1)</script>')),
    ).toBeNull();
  });

  it('rejects other RIFF containers (e.g. WAV)', () => {
    const wav = Buffer.concat([
      Buffer.from('RIFF'),
      Buffer.from([0x24, 0x00, 0x00, 0x00]),
      Buffer.from('WAVEfmt '),
    ]);
    expect(detectImageType(wav)).toBeNull();
  });

  it('rejects GIF, an image type outside the allowed set', () => {
    expect(detectImageType(Buffer.from('GIF89a......'))).toBeNull();
  });

  it('rejects empty and truncated buffers', () => {
    expect(detectImageType(Buffer.alloc(0))).toBeNull();
    expect(detectImageType(Buffer.from([0xff, 0xd8]))).toBeNull();
    expect(detectImageType(undefined)).toBeNull();
  });
});

describe('imageMimeFilter', () => {
  it('accepts the allowed client mimetypes', () => {
    const cb = jest.fn();
    imageMimeFilter({}, { mimetype: 'image/png' } as Express.Multer.File, cb);
    expect(cb).toHaveBeenCalledWith(null, true);
  });

  it('rejects other mimetypes with a clear 400', () => {
    const cb = jest.fn();
    imageMimeFilter(
      {},
      { mimetype: 'application/pdf' } as Express.Multer.File,
      cb,
    );
    const [error] = cb.mock.calls[0];
    expect(error).toBeInstanceOf(BadRequestException);
    expect(error.message).toMatch(/unsupported file type/i);
    expect(cb.mock.calls[0]).toHaveLength(1);
  });
});

describe('evidence PDF support', () => {
  const PDF = Buffer.from('%PDF-1.4 ...');

  it('detectEvidenceType identifies a PDF by its header and still accepts images', () => {
    expect(detectEvidenceType(PDF)).toEqual({
      mimetype: 'application/pdf',
      ext: 'pdf',
    });
    expect(detectEvidenceType(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toEqual({
      mimetype: 'image/jpeg',
      ext: 'jpg',
    });
  });

  it('detectEvidenceType rejects a mislabelled file; detectImageType never accepts a PDF', () => {
    expect(detectEvidenceType(Buffer.from('PK\x03\x04 zip'))).toBeNull();
    expect(detectEvidenceType(Buffer.from('%PDX-'))).toBeNull();
    expect(detectImageType(PDF)).toBeNull();
  });

  it('evidenceMimeFilter allows application/pdf, imageMimeFilter does not', () => {
    const file = { mimetype: 'application/pdf' } as Express.Multer.File;
    const ok = jest.fn();
    evidenceMimeFilter({}, file, ok);
    expect(ok).toHaveBeenCalledWith(null, true);

    const bad = jest.fn();
    imageMimeFilter({}, file, bad);
    expect(bad).toHaveBeenCalledWith(expect.any(Error));
  });
});

describe('evidence allowed types (JPEG, PNG, PDF only)', () => {
  it('detectEvidenceType rejects WebP while detectImageType still accepts it', () => {
    expect(detectEvidenceType(WEBP)).toBeNull();
    expect(detectImageType(WEBP)).toEqual({
      mimetype: 'image/webp',
      ext: 'webp',
    });
  });

  it('detectEvidenceType accepts PNG', () => {
    expect(detectEvidenceType(PNG)).toEqual({
      mimetype: 'image/png',
      ext: 'png',
    });
  });

  it('evidenceMimeFilter rejects image/webp, imageMimeFilter keeps it', () => {
    const webp = { mimetype: 'image/webp' } as Express.Multer.File;
    const bad = jest.fn();
    evidenceMimeFilter({}, webp, bad);
    expect(bad).toHaveBeenCalledWith(expect.any(BadRequestException));

    const ok = jest.fn();
    imageMimeFilter({}, webp, ok);
    expect(ok).toHaveBeenCalledWith(null, true);
  });

  it('an executable renamed .jpg is rejected by content, whatever the declared type', () => {
    const exe = Buffer.concat([Buffer.from('MZ'), Buffer.alloc(64, 0)]);
    expect(detectEvidenceType(exe)).toBeNull();
    expect(detectImageType(exe)).toBeNull();
  });
});
