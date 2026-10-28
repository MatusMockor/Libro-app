import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AddBookService } from '../application/add-book.service.js';
import { BookCatalogueService } from '../application/book-catalogue.service.js';
import { addBookSchema, type AddBookRequest } from './add-book.request.js';
import { bookParamsSchema, type BookParams } from './book-params.request.js';
import { bookSchema, toBookResponse, type BookResponse } from './book.response.js';

@ApiTags('books')
@Controller('books')
export class BooksController {
  constructor(
    private readonly addBook: AddBookService,
    private readonly catalogue: BookCatalogueService,
  ) {}

  @Post()
  @ApiCreatedResponse({
    description: 'The book was added. A duplicate ISBN-13 answers 409 isbn_already_exists',
    standardSchema: bookSchema,
  })
  async add(@Body({ schema: addBookSchema }) book: AddBookRequest): Promise<BookResponse> {
    return toBookResponse(await this.addBook.add(book));
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
