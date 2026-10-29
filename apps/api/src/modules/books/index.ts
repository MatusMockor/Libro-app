export { BookNotFoundException } from './application/book-not-found.exception.js';
export {
  BOOK_CATALOGUE,
  MAX_WORK_SUMMARIES_PER_CALL,
  type BookCatalogue,
} from './book-catalogue.js';
export { BooksModule } from './books.module.js';
export type { WorkSummary } from './domain/book-search.js';
export {
  BookAddedToCatalogue,
  type BookAddedToCataloguePayload,
} from './events/book-added-to-catalogue.event.js';
