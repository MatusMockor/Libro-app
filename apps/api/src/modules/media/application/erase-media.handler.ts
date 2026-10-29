import { Injectable } from '@nestjs/common';
import { OnDomainEvent } from '../../../events/on-domain-event.decorator.js';
import { UserDeleted } from '../../auth/index.js';
import { DeleteMediaService } from './delete-media.service.js';

@Injectable()
export class EraseMediaHandler {
  constructor(private readonly media: DeleteMediaService) {}

  @OnDomainEvent(UserDeleted)
  async onUserDeleted({ payload }: UserDeleted): Promise<void> {
    await this.media.deleteAllOwned(payload.userId);
  }
}
