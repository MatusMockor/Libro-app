import { z } from 'zod';

export const healthReportSchema = z
  .object({
    status: z.enum(['ok', 'error']),
    checks: z.record(z.string(), z.enum(['up', 'down'])).meta({ examples: [{ database: 'up' }] }),
  })
  .meta({ id: 'HealthReport' });

export type HealthReport = z.infer<typeof healthReportSchema>;
