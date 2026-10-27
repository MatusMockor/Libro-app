import { Controller, Get, VERSION_NEUTRAL } from '@nestjs/common';

export interface HealthStatus {
  status: 'ok';
}

@Controller({ path: 'health', version: VERSION_NEUTRAL })
export class HealthController {
  @Get()
  check(): HealthStatus {
    return { status: 'ok' };
  }
}
