import { Inject, Injectable } from '@nestjs/common';
import { INSIGHT_REPOSITORY, type InsightRepository } from './insight-repository.js';
import { InsightNotFoundException } from './insight-not-found.exception.js';

@Injectable()
export class DeleteInsightService {
  constructor(@Inject(INSIGHT_REPOSITORY) private readonly insights: InsightRepository) {}

  async delete(userId: string, insightId: string): Promise<void> {
    if (!(await this.insights.deleteManagedBy(userId, insightId))) {
      throw new InsightNotFoundException();
    }
  }
}
