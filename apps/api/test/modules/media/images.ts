import sharp, { type Exif } from 'sharp';

export interface Size {
  readonly width: number;
  readonly height: number;
}

const BACKGROUND = { r: 120, g: 160, b: 90 };

const XMP = [
  '<x:xmpmeta xmlns:x="adobe:ns:meta/">',
  '<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">',
  '<rdf:Description xmlns:dc="http://purl.org/dc/elements/1.1/" dc:creator="Ann Reader"/>',
  '</rdf:RDF>',
  '</x:xmpmeta>',
].join('');

export const CAMERA_EXIF: Exif = {
  IFD0: { Make: 'Libro Test Camera', Model: 'Reader 1', Copyright: 'Ann Reader' },
  IFD3: {
    GPSLatitudeRef: 'N',
    GPSLatitude: '48/1 8/1 3/1',
    GPSLongitudeRef: 'E',
    GPSLongitude: '17/1 6/1 26/1',
  },
};

const GPS_IFD_POINTER_TAGS = [Buffer.from([0x88, 0x25]), Buffer.from([0x25, 0x88])];

export function hasGpsIfd(exif: Buffer | undefined): boolean {
  return exif !== undefined && GPS_IFD_POINTER_TAGS.some((tag) => exif.includes(tag));
}

function canvas({ width, height }: Size) {
  return sharp({ create: { width, height, channels: 3, background: BACKGROUND } });
}

export function jpeg(size: Size): Promise<Buffer> {
  return canvas(size).jpeg().toBuffer();
}

export function jpegWithCameraMetadata(size: Size): Promise<Buffer> {
  return canvas(size).withExif(CAMERA_EXIF).withXmp(XMP).withIccProfile('p3').jpeg().toBuffer();
}

export function jpegWithOrientation(size: Size, orientation: number): Promise<Buffer> {
  return canvas(size).withMetadata({ orientation }).jpeg().toBuffer();
}

export function png(size: Size): Promise<Buffer> {
  return canvas(size).png().toBuffer();
}

export function webp(size: Size): Promise<Buffer> {
  return canvas(size).webp().toBuffer();
}

export async function animatedWebp({ width, height }: Size, frames: number): Promise<Buffer> {
  const pngs = await Promise.all(
    Array.from({ length: frames }, (_, frame) =>
      sharp({
        create: { width, height, channels: 3, background: { r: frame * 80, g: 40, b: 200 } },
      })
        .png()
        .toBuffer(),
    ),
  );

  return sharp(pngs, { join: { animated: true } })
    .webp({ loop: 0, delay: pngs.map(() => 100) })
    .toBuffer();
}

export function gif(size: Size): Promise<Buffer> {
  return canvas(size).gif().toBuffer();
}

export function avif(size: Size): Promise<Buffer> {
  return canvas(size).avif().toBuffer();
}

export function svg(): Buffer {
  return Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>',
  );
}

export function pixelBomb(): Promise<Buffer> {
  return canvas({ width: 8000, height: 7000 }).png({ compressionLevel: 9 }).toBuffer();
}

export function truncated(image: Buffer): Buffer {
  return image.subarray(0, Math.floor(image.length / 2));
}

export function oversized(bytes: number): Buffer {
  const data = Buffer.alloc(bytes, 0x5a);
  Buffer.from([0xff, 0xd8, 0xff, 0xe0]).copy(data);

  return data;
}
