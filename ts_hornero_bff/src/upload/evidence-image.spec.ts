import { BadRequestException } from '@nestjs/common';
import sharp from 'sharp';
import { sanitizeEvidenceImage } from './evidence-image';

const MARKER = 'HORNEROCAM-SERIAL-1234';

/** True when the EXIF block carries a GPS sub-IFD pointer (tag 0x8825) in IFD0. */
function hasGpsIfd(exif: Buffer | undefined): boolean {
  if (!exif) return false;
  const prefix = exif.indexOf('Exif\0\0');
  const tiff = exif.subarray(prefix === -1 ? 0 : prefix + 6);
  const le = tiff.toString('ascii', 0, 2) === 'II';
  const u16 = (o: number) => (le ? tiff.readUInt16LE(o) : tiff.readUInt16BE(o));
  const u32 = (o: number) => (le ? tiff.readUInt32LE(o) : tiff.readUInt32BE(o));
  const ifd0 = u32(4);
  const count = u16(ifd0);
  for (let i = 0; i < count; i++) {
    if (u16(ifd0 + 2 + i * 12) === 0x8825) return true;
  }
  return false;
}

/** 40x20 landscape image whose EXIF says "rotate 90 CW", with a camera marker and GPS. */
async function withGps(format: 'jpeg' | 'png'): Promise<Buffer> {
  const base = sharp({
    create: {
      width: 40,
      height: 20,
      channels: 3,
      background: { r: 200, g: 30, b: 30 },
    },
  })
    .withExif({
      IFD0: { ImageDescription: MARKER },
      IFD3: {
        GPSLatitudeRef: 'S',
        GPSLatitude: '31/1 24/1 0/1',
        GPSLongitudeRef: 'W',
        GPSLongitude: '64/1 11/1 0/1',
      },
    })
    .withMetadata({ orientation: 6 });
  return format === 'jpeg' ? base.jpeg().toBuffer() : base.png().toBuffer();
}

describe('sanitizeEvidenceImage', () => {
  it.each(['jpeg', 'png'] as const)(
    'fixture sanity: the %s test image really carries GPS EXIF',
    async (format) => {
      const input = await withGps(format);
      const meta = await sharp(input).metadata();
      expect(hasGpsIfd(meta.exif)).toBe(true);
      expect(meta.exif?.includes(MARKER)).toBe(true);
    },
  );

  it.each(['jpeg', 'png'] as const)(
    'removes EXIF and GPS from a %s',
    async (format) => {
      const input = await withGps(format);

      const output = await sanitizeEvidenceImage(
        input,
        format === 'jpeg' ? 'jpg' : 'png',
      );

      const meta = await sharp(output).metadata();
      expect(meta.format).toBe(format);
      expect(meta.exif).toBeUndefined();
      expect(hasGpsIfd(meta.exif)).toBe(false);
      expect(output.includes(MARKER)).toBe(false);
      expect(output.includes('Exif\0\0')).toBe(false);
    },
  );

  it('applies the EXIF orientation before stripping it', async () => {
    const input = await withGps('jpeg');
    expect(await sharp(input).metadata()).toMatchObject({
      width: 40,
      height: 20,
      orientation: 6,
    });

    const output = await sanitizeEvidenceImage(input, 'jpg');

    const meta = await sharp(output).metadata();
    expect({ w: meta.width, h: meta.height }).toEqual({ w: 20, h: 40 });
    expect(meta.orientation).toBeUndefined();
  });

  it('rejects bytes that only look like an image', async () => {
    const fake = Buffer.concat([
      Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]),
      Buffer.from('this is not really a jpeg'),
    ]);
    await expect(sanitizeEvidenceImage(fake, 'jpg')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects a truncated image instead of storing a partial one', async () => {
    const input = await withGps('png');
    await expect(
      sanitizeEvidenceImage(input.subarray(0, input.length - 30), 'png'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
