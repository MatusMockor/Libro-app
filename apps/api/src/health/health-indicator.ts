export const HEALTH_INDICATORS = Symbol('HEALTH_INDICATORS');

export interface HealthIndicator {
  readonly name: string;
  isHealthy(): Promise<boolean>;
}
