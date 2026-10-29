import { describe, expect } from 'vitest';
import type { ProblemDetails } from '../../../src/http/problem-details/problem-details.schema.js';
import { jpeg } from './images.js';
import { MEDIA_ROUTE, test } from './media.fixture.js';
import { startSlowUpload } from './slow-upload.js';
import { admissionOf, httpServerOf, uploadsInFlight } from './upload-admission.fixture.js';

const UPLOAD_BUSY = {
  type: 'about:blank',
  title: 'Too Many Requests',
  status: 429,
  detail: 'Too many uploads are in progress; retry shortly, one upload per user at a time.',
  instance: MEDIA_ROUTE,
  code: 'media_upload_busy',
};

describe('upload admission per user', () => {
  test('answers 429 media_upload_busy to a second upload of the same user before reading its body', async ({
    app,
    uploader,
  }) => {
    const admission = admissionOf(app);
    const image = await jpeg({ width: 800, height: 600 });
    const first = await startSlowUpload(httpServerOf(app), uploader.authorization, image);
    expect(await uploadsInFlight(admission, 1)).toBe(1);

    const second = await startSlowUpload(httpServerOf(app), uploader.authorization, image);
    const rejected = await second.response;
    first.finish();
    const accepted = await first.response;
    second.abort();

    expect(rejected?.status).toBe(429);
    expect(rejected?.headers['retry-after']).toBe('1');
    expect(rejected?.headers['content-type']).toMatch(/^application\/problem\+json/);
    expect(JSON.parse(rejected?.body ?? '{}') as ProblemDetails).toStrictEqual(UPLOAD_BUSY);
    expect(accepted?.status).toBe(201);
    expect(await uploadsInFlight(admission, 0)).toBe(0);
    expect((await uploader.upload(image)).status).toBe(201);
  });

  test('lets other users upload while one upload is running', async ({
    app,
    uploader,
    newUploader,
  }) => {
    const admission = admissionOf(app);
    const image = await jpeg({ width: 400, height: 300 });
    const running = await startSlowUpload(httpServerOf(app), uploader.authorization, image);
    expect(await uploadsInFlight(admission, 1)).toBe(1);
    const other = await newUploader();

    const response = await other.upload(image);
    running.finish();

    expect(response.status).toBe(201);
    expect((await running.response)?.status).toBe(201);
  });

  test('releases the permit after an error response', async ({ app, uploader }) => {
    const admission = admissionOf(app);

    const rejected = await uploader.upload(Buffer.from('not an image'), {
      contentType: 'text/plain',
    });
    const inFlight = admission.inFlight();
    const accepted = await uploader.upload(await jpeg({ width: 40, height: 30 }));

    expect(rejected.status).toBe(415);
    expect(inFlight).toBe(0);
    expect(accepted.status).toBe(201);
  });

  test('releases the permit when the client aborts the upload', async ({ app, uploader }) => {
    const admission = admissionOf(app);
    const image = await jpeg({ width: 800, height: 600 });
    const aborted = await startSlowUpload(httpServerOf(app), uploader.authorization, image);
    expect(await uploadsInFlight(admission, 1)).toBe(1);

    aborted.abort();

    expect(await aborted.response).toBeUndefined();
    expect(await uploadsInFlight(admission, 0)).toBe(0);
    expect((await uploader.upload(image)).status).toBe(201);
  });
});
