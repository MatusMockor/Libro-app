import type { LoggerService } from '@nestjs/common';

export class CapturingLogger implements LoggerService {
  readonly warnings: string[] = [];
  readonly errors: string[] = [];

  log(): void {}

  warn(message: unknown): void {
    this.warnings.push(String(message));
  }

  error(...parts: unknown[]): void {
    this.errors.push(parts.map(String).join('\n'));
  }
}
