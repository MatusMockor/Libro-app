import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import { InProcessUploadAdmission } from '../../../src/modules/media/application/in-process-upload-admission.js';
import { UPLOAD_ADMISSION } from '../../../src/modules/media/application/upload-admission.js';

const POLL_INTERVAL_MS = 10;
const MAX_POLLS = 500;

export function admissionOf(app: INestApplication): InProcessUploadAdmission {
  return app.get<InProcessUploadAdmission>(UPLOAD_ADMISSION);
}

export function httpServerOf(app: INestApplication): Server {
  return app.getHttpServer() as Server;
}

export async function uploadsInFlight(
  admission: InProcessUploadAdmission,
  expected: number,
): Promise<number> {
  for (let poll = 0; poll < MAX_POLLS && admission.inFlight() !== expected; poll += 1) {
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  return admission.inFlight();
}
