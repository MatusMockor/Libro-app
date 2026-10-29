export const UPLOAD_ADMISSION = Symbol('UPLOAD_ADMISSION');

export interface UploadPermit {
  release(): void;
}

export interface UploadAdmission {
  admit(userId: string): UploadPermit | undefined;
}
