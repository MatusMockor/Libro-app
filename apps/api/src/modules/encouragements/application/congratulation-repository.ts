import type { CongratulationKey, NewCongratulation } from '../domain/congratulation.js';

export const CONGRATULATION_REPOSITORY = Symbol('CONGRATULATION_REPOSITORY');

export interface CongratulationRepository {
  add(congratulation: NewCongratulation): Promise<boolean>;
  delete(key: CongratulationKey): Promise<void>;
}
