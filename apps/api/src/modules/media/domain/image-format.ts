export const ACCEPTED_IMAGE_FORMATS = ['jpeg', 'png', 'webp'] as const;

export type AcceptedImageFormat = (typeof ACCEPTED_IMAGE_FORMATS)[number];

interface Signature {
  readonly offset: number;
  readonly bytes: readonly number[];
}

const ascii = (offset: number, text: string): Signature => ({
  offset,
  bytes: Array.from(text, (character) => character.charCodeAt(0)),
});

const SIGNATURES: Readonly<Record<AcceptedImageFormat, readonly Signature[]>> = {
  jpeg: [{ offset: 0, bytes: [0xff, 0xd8, 0xff] }],
  png: [{ offset: 0, bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] }],
  webp: [ascii(0, 'RIFF'), ascii(8, 'WEBP')],
};

export function detectImageFormat(data: Uint8Array): AcceptedImageFormat | undefined {
  return ACCEPTED_IMAGE_FORMATS.find((format) =>
    SIGNATURES[format].every((signature) => matches(data, signature)),
  );
}

function matches(data: Uint8Array, { offset, bytes }: Signature): boolean {
  return bytes.every((byte, index) => data[offset + index] === byte);
}
