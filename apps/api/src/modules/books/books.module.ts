import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AddBookService } from './application/add-book.service.js';
import { BookCatalogueService } from './application/book-catalogue.service.js';
import { BOOK_SEARCH_REPOSITORY } from './application/book-search-repository.js';
import { SearchBooksService } from './application/search-books.service.js';
import { WORK_REPOSITORY } from './application/work-repository.js';
import { BOOK_CATALOGUE } from './book-catalogue.js';
import { BooksController } from './http/books.controller.js';
import { AuthorEntity } from './persistence/author.entity.js';
import { EditionEntity } from './persistence/edition.entity.js';
import { TypeOrmBookSearchRepository } from './persistence/typeorm-book-search.repository.js';
import { TypeOrmWorkRepository } from './persistence/typeorm-work.repository.js';
import { WorkAuthorEntity } from './persistence/work-author.entity.js';
import { WorkEntity } from './persistence/work.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([WorkEntity, AuthorEntity, WorkAuthorEntity, EditionEntity])],
  controllers: [BooksController],
  providers: [
    AddBookService,
    BookCatalogueService,
    SearchBooksService,
    { provide: WORK_REPOSITORY, useClass: TypeOrmWorkRepository },
    { provide: BOOK_SEARCH_REPOSITORY, useClass: TypeOrmBookSearchRepository },
    { provide: BOOK_CATALOGUE, useExisting: BookCatalogueService },
  ],
  exports: [BOOK_CATALOGUE],
})
export class BooksModule {}
