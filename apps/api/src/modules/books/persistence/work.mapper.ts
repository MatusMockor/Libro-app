import type { Edition, NewWork, Work } from '../domain/work.js';
import { AuthorEntity } from './author.entity.js';
import { EditionEntity } from './edition.entity.js';
import { WorkAuthorEntity } from './work-author.entity.js';
import { WorkEntity } from './work.entity.js';

export function toWorkEntity({ title, authors, editions }: NewWork): WorkEntity {
  return Object.assign(new WorkEntity(), {
    title,
    workAuthors: authors.map((name, index) =>
      Object.assign(new WorkAuthorEntity(), {
        position: index + 1,
        author: Object.assign(new AuthorEntity(), { name }),
      }),
    ),
    editions: editions.map((edition) => Object.assign(new EditionEntity(), edition)),
  });
}

export function toWork({ id, title, workAuthors, editions }: WorkEntity): Work {
  return {
    id,
    title,
    authors: workAuthors
      .toSorted((left, right) => left.position - right.position)
      .map(({ author }) => ({ id: author.id, name: author.name })),
    editions: editions.map(toEdition).toSorted(byPublication),
  };
}

function toEdition({ id, isbn13, language, title, publishedYear }: EditionEntity): Edition {
  return { id, isbn13, language, title, publishedYear };
}

function byPublication(left: Edition, right: Edition): number {
  return (
    (left.publishedYear ?? Infinity) - (right.publishedYear ?? Infinity) ||
    left.id.localeCompare(right.id)
  );
}
