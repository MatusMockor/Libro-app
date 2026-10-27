import { Module } from '@nestjs/common';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { HttpExceptionMapper } from './problem-details/http-exception.mapper.js';
import { ProblemDetailsFilter } from './problem-details/problem-details.filter.js';
import { ProblemExceptionMapper } from './problem-details/problem-exception.mapper.js';
import { PROBLEM_MAPPERS, type ProblemMapper } from './problem-details/problem-mapper.js';
import { createValidationPipe } from './validation/validation.pipe.js';

@Module({
  providers: [
    { provide: APP_PIPE, useFactory: createValidationPipe },
    {
      provide: PROBLEM_MAPPERS,
      useFactory: (): ProblemMapper[] => [new ProblemExceptionMapper(), new HttpExceptionMapper()],
    },
    { provide: APP_FILTER, useClass: ProblemDetailsFilter },
  ],
})
export class HttpApiModule {}
