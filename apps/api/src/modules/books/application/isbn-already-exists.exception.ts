import { HttpStatus } from '@nestjs/common';
import { ProblemException } from '../../../http/problem-details/problem.exception.js';

export class IsbnAlreadyExistsException extends ProblemException {
  constructor() {
    super({
      status: HttpStatus.CONFLICT,
      code: 'isbn_already_exists',
      detail: 'An edition with this ISBN-13 is already in the catalogue.',
    });
  }
}
