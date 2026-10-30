import { PostNotFoundException } from './post-not-found.exception.js';

export function ensurePostExists(postExists: boolean): void {
  if (!postExists) {
    throw new PostNotFoundException();
  }
}
