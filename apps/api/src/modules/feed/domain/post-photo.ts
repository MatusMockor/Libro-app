import type { MediaWithUrls } from '../../media/index.js';

export const MAX_POST_PHOTOS = 4;

export type PostPhoto = Pick<
  MediaWithUrls,
  'id' | 'width' | 'height' | 'variants' | 'urlsExpireAt'
>;
