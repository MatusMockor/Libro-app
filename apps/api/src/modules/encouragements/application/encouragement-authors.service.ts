import { Inject, Injectable } from '@nestjs/common';
import {
  PROFILE_DIRECTORY,
  type ProfileDirectory,
  type ProfileSummary,
} from '../../profiles/index.js';

interface Authored {
  readonly authorId: string;
}

type WithAuthor<TItem> = TItem & { readonly author: ProfileSummary | null };

@Injectable()
export class EncouragementAuthorsService {
  constructor(@Inject(PROFILE_DIRECTORY) private readonly profiles: ProfileDirectory) {}

  async withAuthor<TItem extends Authored>(
    viewerId: string,
    item: TItem,
  ): Promise<WithAuthor<TItem>> {
    return attach(item, await this.authorsOf(viewerId, [item]));
  }

  async withAuthors<TItem extends Authored>(
    viewerId: string,
    items: readonly TItem[],
  ): Promise<WithAuthor<TItem>[]> {
    const authors = await this.authorsOf(viewerId, items);

    return items.map((item) => attach(item, authors));
  }

  private authorsOf(
    viewerId: string,
    items: readonly Authored[],
  ): Promise<ReadonlyMap<string, ProfileSummary>> {
    return this.profiles.findSummaries(
      viewerId,
      items.map(({ authorId }) => authorId),
    );
  }
}

function attach<TItem extends Authored>(
  item: TItem,
  authors: ReadonlyMap<string, ProfileSummary>,
): WithAuthor<TItem> {
  return { ...item, author: authors.get(item.authorId) ?? null };
}
