import { Inject, Injectable } from '@nestjs/common';
import { OnDomainEvent } from '../../../events/on-domain-event.decorator.js';
import { UserDeleted } from '../../auth/index.js';
import {
  FINISHED_TREE_REPOSITORY,
  type FinishedTreeRepository,
} from './finished-tree-repository.js';

@Injectable()
export class EraseFinishedTreesHandler {
  constructor(
    @Inject(FINISHED_TREE_REPOSITORY) private readonly finishedTrees: FinishedTreeRepository,
  ) {}

  @OnDomainEvent(UserDeleted)
  async onUserDeleted({ payload }: UserDeleted): Promise<void> {
    await this.finishedTrees.deleteAllOf(payload.userId);
  }
}
