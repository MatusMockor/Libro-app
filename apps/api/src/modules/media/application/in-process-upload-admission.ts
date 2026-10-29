import type { UploadAdmission, UploadPermit } from './upload-admission.js';

export class InProcessUploadAdmission implements UploadAdmission {
  private readonly uploaders = new Set<string>();

  constructor(private readonly concurrency: number) {}

  admit(userId: string): UploadPermit | undefined {
    if (this.uploaders.size >= this.concurrency || this.uploaders.has(userId)) {
      return undefined;
    }

    this.uploaders.add(userId);
    let released = false;

    return {
      release: () => {
        if (released) {
          return;
        }

        released = true;
        this.uploaders.delete(userId);
      },
    };
  }

  inFlight(): number {
    return this.uploaders.size;
  }
}
