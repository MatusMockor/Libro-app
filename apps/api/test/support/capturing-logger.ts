import type { LoggerService } from '@nestjs/common';

export class CapturingLogger implements LoggerService {
  readonly warnings: string[] = [];

  log(): void {}

  warn(message: unknown): void {
    this.warnings.push(String(message));
  }

  error(): void {}
}
