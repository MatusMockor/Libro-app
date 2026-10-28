import { HttpStatus } from '@nestjs/common';
import { ProblemException } from '../../../http/problem-details/problem.exception.js';

export class BookNotFoundException extends ProblemException {
  constructor(workId: string) {
    super({
      status: HttpStatus.NOT_FOUND,
      code: 'book_not_found',
      detail: `No book with id ${workId} is in the catalogue.`,
    });
  }
}
