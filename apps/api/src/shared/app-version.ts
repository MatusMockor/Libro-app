export const APP_VERSION_PATTERN = /^\d+\.\d+\.\d+$/;

export class AppVersion {
  private constructor(
    readonly major: number,
    readonly minor: number,
    readonly patch: number,
  ) {}

  static parse(value: string): AppVersion | undefined {
    if (!APP_VERSION_PATTERN.test(value)) {
      return undefined;
    }

    const [major, minor, patch] = value.split('.').map(Number) as [number, number, number];
    if (![major, minor, patch].every(Number.isSafeInteger)) {
      return undefined;
    }

    return new AppVersion(major, minor, patch);
  }

  isOlderThan(other: AppVersion): boolean {
    return this.compareTo(other) < 0;
  }

  toString(): string {
    return [this.major, this.minor, this.patch].join('.');
  }

  private compareTo(other: AppVersion): number {
    return this.major - other.major || this.minor - other.minor || this.patch - other.patch;
  }
}
