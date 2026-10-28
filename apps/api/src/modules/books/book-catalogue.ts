export const BOOK_CATALOGUE = Symbol('BOOK_CATALOGUE');

export interface BookCatalogue {
  workExists(workId: string): Promise<boolean>;
}
