export type { EncouragementKind } from './domain/encouragement.js';
export { EncouragementsModule } from './encouragements.module.js';
export {
  CongratulationAdded,
  type CongratulationAddedPayload,
} from './events/congratulation-added.event.js';
export { InsightAdded, type InsightAddedPayload } from './events/insight-added.event.js';
export {
  MAX_DECORATED_READINGS_PER_CALL,
  MAX_DECORATIONS_PER_READING,
  READING_ENCOURAGEMENTS,
  type EncouragementDecoration,
  type ReadingEncouragements,
} from './reading-encouragements.js';
