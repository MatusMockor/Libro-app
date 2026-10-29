import { Injectable } from '@nestjs/common';
import sharp, { type Metadata, type SharpOptions } from 'sharp';
import type {
  ImageProcessor,
  ProcessedImage,
  ProcessedVariant,
} from '../application/image-processor.js';
import { MediaTooManyPixelsException } from '../application/media-too-many-pixels.exception.js';
import { UnsupportedMediaTypeException } from '../application/unsupported-media-type.exception.js';
import { detectImageFormat, type AcceptedImageFormat } from '../domain/image-format.js';
import { MAX_INPUT_PIXELS } from '../domain/media-limits.js';
import {
  MEDIA_VARIANT_LONGER_SIDE,
  MEDIA_VARIANT_NAMES,
  type MediaVariantName,
} from '../domain/media-variant.js';

const INPUT_OPTIONS: SharpOptions = {
  limitInputPixels: MAX_INPUT_PIXELS,
  pages: 1,
  page: 0,
};

const WEBP_QUALITY = 82;

const PIXEL_LIMIT_ERROR = /pixel limit/i;

interface DecodedImage {
  readonly data: Buffer;
  readonly width: number;
  readonly height: number;
  readonly channels: 1 | 2 | 3 | 4;
}

@Injectable()
export class SharpImageProcessor implements ImageProcessor {
  async process(input: Buffer): Promise<ProcessedImage> {
    const format = detectImageFormat(input);
    if (!format) {
      throw new UnsupportedMediaTypeException();
    }

    await this.ensureDecodable(input, format);
    const decoded = await this.decode(input);
    const variants = await Promise.all(
      MEDIA_VARIANT_NAMES.map((name) => this.encode(decoded, name)),
    );

    return { width: decoded.width, height: decoded.height, variants };
  }

  private async ensureDecodable(input: Buffer, format: AcceptedImageFormat): Promise<void> {
    const metadata = await this.metadataOf(input);
    if (metadata.format !== format) {
      throw new UnsupportedMediaTypeException();
    }

    if (metadata.width * (metadata.pageHeight ?? metadata.height) > MAX_INPUT_PIXELS) {
      throw new MediaTooManyPixelsException(MAX_INPUT_PIXELS);
    }
  }

  private async metadataOf(input: Buffer): Promise<Metadata> {
    try {
      return await sharp(input, INPUT_OPTIONS).metadata();
    } catch (error) {
      throw toProblem(error);
    }
  }

  private async decode(input: Buffer): Promise<DecodedImage> {
    const longerSide = MEDIA_VARIANT_LONGER_SIDE.large;

    try {
      const { data, info } = await sharp(input, INPUT_OPTIONS)
        .autoOrient()
        .resize({ width: longerSide, height: longerSide, fit: 'inside', withoutEnlargement: true })
        .toColourspace('srgb')
        .raw({ depth: 'uchar' })
        .toBuffer({ resolveWithObject: true });

      return { data, width: info.width, height: info.height, channels: info.channels };
    } catch (error) {
      throw toProblem(error);
    }
  }

  private async encode(decoded: DecodedImage, name: MediaVariantName): Promise<ProcessedVariant> {
    const longerSide = MEDIA_VARIANT_LONGER_SIDE[name];
    const { width, height, channels } = decoded;
    const { data, info } = await sharp(decoded.data, { raw: { width, height, channels } })
      .resize({ width: longerSide, height: longerSide, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: WEBP_QUALITY })
      .toBuffer({ resolveWithObject: true });

    return { name, data, width: info.width, height: info.height };
  }
}

function toProblem(error: unknown): Error {
  if (error instanceof Error && PIXEL_LIMIT_ERROR.test(error.message)) {
    return new MediaTooManyPixelsException(MAX_INPUT_PIXELS);
  }

  return new UnsupportedMediaTypeException();
}
