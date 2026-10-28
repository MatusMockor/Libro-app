import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AddBookService } from '../application/add-book.service.js';
import { BookCatalogueService } from '../application/book-catalogue.service.js';
import { SearchBooksService } from '../application/search-books.service.js';
import { addBookSchema, type AddBookRequest } from './add-book.request.js';
import { bookParamsSchema, type BookParams } from './book-params.request.js';
import {
  bookSearchSchema,
  toBookSearchResponse,
  type BookSearchResponse,
} from './book-search.response.js';
import { bookSchema, toBookResponse, type BookResponse } from './book.response.js';
import { searchBooksQuerySchema, type SearchBooksQuery } from './search-books.request.js';

@ApiTags('books')
@Controller('books')
export class BooksController {
  constructor(
    private readonly addBook: AddBookService,
    private readonly catalogue: BookCatalogueService,
    private readonly searchBooks: SearchBooksService,
  ) {}

  @Post()
  @ApiCreatedResponse({
    description: 'The book was added. A duplicate ISBN-13 answers 409 isbn_already_exists',
    standardSchema: bookSchema,
  })
  async add(@Body({ schema: addBookSchema }) book: AddBookRequest): Promise<BookResponse> {
    return toBookResponse(await this.addBook.add(book));
  }

  @Get()
  @ApiOkResponse({
    description:
      'Books whose title, edition titles or author names contain every word of q, ignoring case and diacritics, or whose edition has the ISBN in q. Best match first',
    standardSchema: bookSearchSchema,
  })
  async search(
    @Query({ schema: searchBooksQuerySchema }) { q, limit, offset }: SearchBooksQuery,
  ): Promise<BookSearchResponse> {
    return toBookSearchResponse(await this.searchBooks.search({ text: q, limit, offset }));
  }

  @Get(':workId')
  @ApiOkResponse({
    description: 'The book with its authors and editions. An unknown id answers 404 book_not_found',
    standardSchema: bookSchema,
  })
  async find(@Param({ schema: bookParamsSchema }) { workId }: BookParams): Promise<BookResponse> {
    return toBookResponse(await this.catalogue.getWork(workId));
  }
}
