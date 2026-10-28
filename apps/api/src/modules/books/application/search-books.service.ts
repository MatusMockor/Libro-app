import { Inject, Injectable } from '@nestjs/common';
import {
  BOOK_SEARCH_MAX_OFFSET,
  searchedIsbn13,
  type BookSearchPage,
  type BookSearchQuery,
} from '../domain/book-search.js';
import { BOOK_SEARCH_REPOSITORY, type BookSearchRepository } from './book-search-repository.js';

@Injectable()
export class SearchBooksService {
  constructor(@Inject(BOOK_SEARCH_REPOSITORY) private readonly books: BookSearchRepository) {}

  async search({ text, limit, offset }: BookSearchQuery): Promise<BookSearchPage> {
    const found = await this.books.search({
      text,
      isbn13: searchedIsbn13(text),
      limit: limit + 1,
      offset,
    });
    const nextOffset = offset + limit;
    const hasNextPage = found.length > limit && nextOffset <= BOOK_SEARCH_MAX_OFFSET;

    return { items: found.slice(0, limit), nextOffset: hasNextPage ? nextOffset : null };
  }
}
