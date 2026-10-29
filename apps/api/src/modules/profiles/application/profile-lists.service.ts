import { Inject, Injectable } from '@nestjs/common';
import type {
  ProfileSearchQuery,
  ProfileSummary,
  StoredProfileSummary,
} from '../domain/profile.js';
import { lookahead, pageOf, type Page, type PageQuery } from '../domain/profile-page.js';
import { ProfileAssemblerService } from './profile-assembler.service.js';
import { ProfileNotFoundException } from './profile-not-found.exception.js';
import { PROFILE_REPOSITORY, type ProfileRepository } from './profile-repository.js';
import {
  PROFILE_SUMMARY_REPOSITORY,
  type ProfileSummaryRepository,
} from './profile-summary-repository.js';

@Injectable()
export class ProfileListsService {
  constructor(
    @Inject(PROFILE_REPOSITORY) private readonly profiles: ProfileRepository,
    @Inject(PROFILE_SUMMARY_REPOSITORY) private readonly summaries: ProfileSummaryRepository,
    private readonly assembler: ProfileAssemblerService,
  ) {}

  async search(viewerId: string, query: ProfileSearchQuery): Promise<Page<ProfileSummary>> {
    const found = await this.summaries.search(viewerId, { ...query, ...lookahead(query) });

    return this.page(found, query);
  }

  async followers(
    viewerId: string,
    userId: string,
    page: PageQuery,
  ): Promise<Page<ProfileSummary>> {
    await this.ensureExists(userId);

    return this.page(await this.summaries.followersOf(viewerId, userId, lookahead(page)), page);
  }

  async following(
    viewerId: string,
    userId: string,
    page: PageQuery,
  ): Promise<Page<ProfileSummary>> {
    await this.ensureExists(userId);

    return this.page(await this.summaries.followingOf(viewerId, userId, lookahead(page)), page);
  }

  private async ensureExists(userId: string): Promise<void> {
    if (!(await this.profiles.exists(userId))) {
      throw new ProfileNotFoundException();
    }
  }

  private async page(
    found: readonly StoredProfileSummary[],
    query: PageQuery,
  ): Promise<Page<ProfileSummary>> {
    const { items, nextOffset } = pageOf(found, query);

    return { items: await this.assembler.summaries(items), nextOffset };
  }
}
