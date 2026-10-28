import { ThrottlerStorageService, type ThrottlerStorage } from '@nestjs/throttler';

export class ResettableThrottlerStorage implements ThrottlerStorage {
  private storage = new ThrottlerStorageService();

  increment(
    ...hit: Parameters<ThrottlerStorage['increment']>
  ): ReturnType<ThrottlerStorage['increment']> {
    return this.storage.increment(...hit);
  }

  reset(): void {
    this.storage.onApplicationShutdown();
    this.storage = new ThrottlerStorageService();
  }
}
