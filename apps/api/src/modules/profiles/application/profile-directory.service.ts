import { Inject, Injectable } from '@nestjs/common';
import type { ProfileSummary } from '../domain/profile.js';
import { distinctIdBatch } from '../../../shared/id-batch.js';
import { MAX_PROFILE_SUMMARIES_PER_CALL, type ProfileDirectory } from '../profile-directory.js';
import { OfficialAccountsService } from './official-accounts.service.js';
import { ProfileAssemblerService } from './profile-assembler.service.js';
import {
  PROFILE_SUMMARY_REPOSITORY,
  type ProfileSummaryRepository,
} from './profile-summary-repository.js';

@Injectable()
export class ProfileDirectoryService implements ProfileDirectory {
  constructor(
    @Inject(PROFILE_SUMMARY_REPOSITORY) private readonly summaries: ProfileSummaryRepository,
    private readonly assembler: ProfileAssemblerService,
    private readonly officialAccounts: OfficialAccountsService,
  ) {}

  async findSummaries(
    viewerId: string,
    userIds: readonly string[],
  ): Promise<ReadonlyMap<string, ProfileSummary>> {
    const distinct = distinctIdBatch(userIds, MAX_PROFILE_SUMMARIES_PER_CALL);
    if (distinct.length === 0) {
      return new Map();
    }

    const found = await this.assembler.summaries(
      await this.summaries.findByUserIds(viewerId, distinct),
    );

    return new Map(found.map((summary) => [summary.userId, summary]));
  }

  officialUserIds(): Promise<string[]> {
    return this.officialAccounts.officialUserIds();
  }
}
