import { describe, expect, vi } from 'vitest';
import type { ProblemDetails } from '../../../src/http/problem-details/problem-details.schema.js';

vi.stubEnv('MEDIA_UPLOAD_CONCURRENCY', '2');

const { jpeg } = await import('./images.js');
const { test } = await import('./media.fixture.js');
const { startSlowUpload } = await import('./slow-upload.js');
const { admissionOf, httpServerOf, uploadsInFlight } =
  await import('./upload-admission.fixture.js');

describe('upload admission with MEDIA_UPLOAD_CONCURRENCY=2', () => {
  test('answers 429 media_upload_busy to a third user while two uploads are running', async ({
    app,
    newUploader,
  }) => {
    const admission = admissionOf(app);
    const image = await jpeg({ width: 400, height: 300 });
    const [first, second, third] = await Promise.all([newUploader(), newUploader(), newUploader()]);
    const running = [
      await startSlowUpload(httpServerOf(app), first.authorization, image),
      await startSlowUpload(httpServerOf(app), second.authorization, image),
    ];
    expect(await uploadsInFlight(admission, 2)).toBe(2);

    const blocked = await startSlowUpload(httpServerOf(app), third.authorization, image);
    const rejected = await blocked.response;
    blocked.abort();
    for (const upload of running) {
      upload.finish();
    }
    const accepted = await Promise.all(running.map(({ response }) => response));

    expect(rejected?.status).toBe(429);
    expect(rejected?.headers['retry-after']).toBe('1');
    expect((JSON.parse(rejected?.body ?? '{}') as ProblemDetails).code).toBe('media_upload_busy');
    expect(accepted.map((response) => response?.status)).toEqual([201, 201]);
    expect(await uploadsInFlight(admission, 0)).toBe(0);
    expect((await third.upload(image)).status).toBe(201);
  });
});
