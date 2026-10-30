import { Inject, Injectable } from '@nestjs/common';
import { OnDomainEvent } from '../../../events/on-domain-event.decorator.js';
import { UserDeleted } from '../../auth/index.js';
import {
  ENCOURAGEMENT_REPOSITORY,
  type EncouragementRepository,
} from './encouragement-repository.js';

@Injectable()
export class EraseEncouragementsHandler {
  constructor(
    @Inject(ENCOURAGEMENT_REPOSITORY) private readonly encouragements: EncouragementRepository,
  ) {}

  @OnDomainEvent(UserDeleted)
  async onUserDeleted({ payload }: UserDeleted): Promise<void> {
    await this.encouragements.deleteAllOf(payload.userId);
  }
}
