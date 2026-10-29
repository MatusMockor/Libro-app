import type { MediaVariantName } from '../domain/media-variant.js';

export const IMAGE_PROCESSOR = Symbol('IMAGE_PROCESSOR');

export interface ProcessedVariant {
  readonly name: MediaVariantName;
  readonly data: Buffer;
  readonly width: number;
  readonly height: number;
}

export interface ProcessedImage {
  readonly width: number;
  readonly height: number;
  readonly variants: readonly ProcessedVariant[];
}

export interface ImageProcessor {
  process(input: Buffer): Promise<ProcessedImage>;
}
