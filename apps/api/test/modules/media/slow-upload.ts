import { request, type IncomingHttpHeaders, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { MEDIA_ROUTE } from './media.fixture.js';

const BOUNDARY = 'libro-slow-upload-boundary';

export interface SlowUploadResponse {
  readonly status: number;
  readonly headers: IncomingHttpHeaders;
  readonly body: string;
}

export interface SlowUpload {
  readonly response: Promise<SlowUploadResponse | undefined>;
  finish(): void;
  abort(): void;
}

export async function listeningPort(server: Server): Promise<number> {
  if (!server.listening) {
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', resolve);
    });
  }

  return (server.address() as AddressInfo).port;
}

export async function startSlowUpload(
  server: Server,
  authorization: string,
  image: Buffer,
): Promise<SlowUpload> {
  const port = await listeningPort(server);
  const head = Buffer.from(
    [
      `--${BOUNDARY}`,
      'Content-Disposition: form-data; name="file"; filename="photo.jpg"',
      'Content-Type: image/jpeg',
      '',
      '',
    ].join('\r\n'),
  );
  const tail = Buffer.from(`\r\n--${BOUNDARY}--\r\n`);
  const half = Math.floor(image.length / 2);
  const upload = request({
    host: '127.0.0.1',
    port,
    method: 'POST',
    path: MEDIA_ROUTE,
    headers: {
      authorization,
      'content-type': `multipart/form-data; boundary=${BOUNDARY}`,
      'content-length': String(head.length + image.length + tail.length),
    },
  });
  const response = new Promise<SlowUploadResponse | undefined>((resolve) => {
    upload.on('response', (incoming) => {
      const chunks: Buffer[] = [];
      incoming.on('data', (chunk: Buffer) => chunks.push(chunk));
      incoming.on('end', () => {
        resolve({
          status: incoming.statusCode ?? 0,
          headers: incoming.headers,
          body: Buffer.concat(chunks).toString('utf8'),
        });
      });
      incoming.on('error', () => {
        resolve(undefined);
      });
    });
    upload.on('error', () => {
      resolve(undefined);
    });
  });

  upload.write(Buffer.concat([head, image.subarray(0, half)]));

  return {
    response,
    finish: () => {
      upload.end(Buffer.concat([image.subarray(half), tail]));
    },
    abort: () => {
      upload.destroy();
    },
  };
}
