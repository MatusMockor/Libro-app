import type { ProfileChanges, StoredProfile } from '../domain/profile.js';

export const PROFILE_REPOSITORY = Symbol('PROFILE_REPOSITORY');

export type ProfileCreation = 'created' | 'exists' | 'handle_taken';

export interface ProfileRepository {
  exists(userId: string): Promise<boolean>;
  create(userId: string, handle: string): Promise<ProfileCreation>;
  findById(viewerId: string, userId: string): Promise<StoredProfile | undefined>;
  findByHandle(viewerId: string, handle: string): Promise<StoredProfile | undefined>;
  update(userId: string, changes: ProfileChanges): Promise<void>;
}
