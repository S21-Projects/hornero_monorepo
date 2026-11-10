import { BadRequestException } from '@nestjs/common';
import sharp from 'sharp';

/** Refuses decompression bombs: a small file can declare a gigantic canvas. */
const MAX_INPUT_PIXELS = 50_000_000;

/**
 * Re-encodes a JPEG or PNG so the stored bytes carry no EXIF, GPS or other embedded metadata.
 *
 * `rotate()` with no argument applies the EXIF orientation to the pixels first, so removing the
 * tag does not leave the picture sideways. sharp drops metadata on output unless asked to keep
 * it, which is the behaviour relied on here. `failOn: 'error'` makes a truncated or corrupt
 * image throw instead of being silently repaired; the caller never stores it.
 */
export async function sanitizeEvidenceImage(
  buffer: Buffer,
  ext: 'jpg' | 'png',
): Promise<Buffer> {
  try {
    const pipeline = sharp(buffer, {
      failOn: 'error',
      limitInputPixels: MAX_INPUT_PIXELS,
    }).rotate();
    return await (
      ext === 'jpg' ? pipeline.jpeg({ quality: 90 }) : pipeline.png()
    ).toBuffer();
  } catch {
    throw new BadRequestException(
      'The image is corrupt or cannot be processed',
    );
  }
}
