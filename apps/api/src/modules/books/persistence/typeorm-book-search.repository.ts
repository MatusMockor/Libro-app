import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { BookSearchRepository } from '../application/book-search-repository.js';
import type { BookSearch, WorkSummary } from '../domain/book-search.js';
import { WorkEntity } from './work.entity.js';

const MAX_SEARCH_TOKENS = 5;

const SEARCH_WORKS = String.raw`
  WITH query AS (
    SELECT books.search_normalise($1) AS text
  ),
  distinct_tokens AS (
    SELECT token
    FROM query,
      regexp_split_to_table(btrim(query.text), '\s+') WITH ORDINALITY AS split (token, position)
    WHERE token <> ''
    GROUP BY token
    ORDER BY min(position)
    LIMIT $5
  ),
  tokens AS (
    SELECT
      token,
      '%' || replace(replace(replace(token, '\', '\\'), '%', '\%'), '_', '\_') || '%' AS pattern
    FROM distinct_tokens
  ),
  token_matches AS (
    SELECT tokens.token, works.id AS work_id
    FROM tokens
    JOIN books.works ON books.search_normalise(works.title) LIKE tokens.pattern
    UNION
    SELECT tokens.token, editions.work_id
    FROM tokens
    JOIN books.editions ON books.search_normalise(editions.title) LIKE tokens.pattern
    UNION
    SELECT tokens.token, work_authors.work_id
    FROM tokens
    JOIN books.authors ON books.search_normalise(authors.name) LIKE tokens.pattern
    JOIN books.work_authors ON work_authors.author_id = authors.id
  ),
  found AS (
    SELECT work_id
    FROM token_matches
    GROUP BY work_id
    HAVING count(*) = (SELECT count(*) FROM tokens)
    UNION
    SELECT work_id FROM books.editions WHERE isbn13 = $2
  ),
  ranked AS (
    SELECT
      works.id,
      works.title,
      greatest(
        word_similarity(query.text, books.search_normalise(works.title)),
        (
          SELECT max(word_similarity(query.text, books.search_normalise(editions.title)))
          FROM books.editions
          WHERE editions.work_id = works.id
        ),
        (
          SELECT max(word_similarity(query.text, books.search_normalise(authors.name)))
          FROM books.work_authors
          JOIN books.authors ON authors.id = work_authors.author_id
          WHERE work_authors.work_id = works.id
        )
      ) AS score
    FROM found
    JOIN books.works ON works.id = found.work_id
    CROSS JOIN query
  ),
  page AS (
    SELECT id, title, score
    FROM ranked
    ORDER BY score DESC, title, id
    LIMIT $3 OFFSET $4
  )
  SELECT
    page.id,
    page.title,
    coalesce(
      json_agg(json_build_object('id', authors.id, 'name', authors.name) ORDER BY work_authors.position)
        FILTER (WHERE authors.id IS NOT NULL),
      '[]'
    ) AS authors
  FROM page
  LEFT JOIN books.work_authors ON work_authors.work_id = page.id
  LEFT JOIN books.authors ON authors.id = work_authors.author_id
  GROUP BY page.id, page.title, page.score
  ORDER BY page.score DESC, page.title, page.id
`;

@Injectable()
export class TypeOrmBookSearchRepository implements BookSearchRepository {
  constructor(@InjectRepository(WorkEntity) private readonly works: Repository<WorkEntity>) {}

  search({ text, isbn13, limit, offset }: BookSearch): Promise<WorkSummary[]> {
    return this.works.query<WorkSummary[]>(SEARCH_WORKS, [
      text,
      isbn13,
      limit,
      offset,
      MAX_SEARCH_TOKENS,
    ]);
  }
}
