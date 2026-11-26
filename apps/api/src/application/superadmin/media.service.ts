import { BadRequestException, Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

/**
 * Images uploaded from the backoffice.
 *
 * The browser sends the picked file as a base64 data URL (the same shape the
 * avatar picker already uses), so no extra multipart dependency is needed.
 * Files land on disk with a random name and are served read-only from
 * `GET /api/media/:file`; the page block only stores that URL.
 */

/** Largest accepted file: enough for a retina screenshot, small enough to inline. */
const MAX_BYTES = 5 * 1024 * 1024;

const IMAGE_EXTENSIONS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

/** Leading bytes per format: a renamed `.exe` is rejected, not stored. */
const SIGNATURES: Record<string, (buffer: Buffer) => boolean> = {
  png: (buffer) => buffer.subarray(0, 4).toString('hex') === '89504e47',
  jpg: (buffer) =>
    buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff,
  gif: (buffer) => buffer.subarray(0, 3).toString('ascii') === 'GIF',
  webp: (buffer) =>
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP',
};

const DATA_URL =
  /^data:(image\/(?:png|jpeg|webp|gif));base64,([A-Za-z0-9+/=\s]+)$/;

@Injectable()
export class MediaService {
  /** Same working directory the API runs from (repo root in production). */
  private readonly directory = join(
    process.env.UPLOAD_DIR || process.cwd(),
    'uploads',
  );

  saveImage(dataUrl: unknown): { url: string } {
    const match = DATA_URL.exec(typeof dataUrl === 'string' ? dataUrl : '');
    if (!match) {
      throw new BadRequestException(
        'Expected a base64 PNG, JPEG, WebP or GIF image',
      );
    }
    const mime = match[1];
    const extension = IMAGE_EXTENSIONS[mime];
    const buffer = Buffer.from(match[2].replace(/\s/g, ''), 'base64');

    if (!buffer.length) {
      throw new BadRequestException('The image is empty');
    }
    if (buffer.length > MAX_BYTES) {
      throw new BadRequestException('Images must be 5 MB or smaller');
    }
    if (!SIGNATURES[extension](buffer)) {
      throw new BadRequestException('The file is not a valid image');
    }

    const filename = `${Date.now().toString(36)}-${randomBytes(8).toString(
      'hex',
    )}.${extension}`;
    mkdirSync(this.directory, { recursive: true });
    writeFileSync(join(this.directory, filename), buffer);
    return { url: `/api/media/${filename}` };
  }

  /** Resolves a stored name to an absolute path, refusing anything else. */
  pathFor(filename: string): string | null {
    if (!/^[a-z0-9]+-[a-f0-9]{16}\.(png|jpg|webp|gif)$/.test(filename)) {
      return null;
    }
    return join(this.directory, filename);
  }
}
