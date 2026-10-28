import {
  Body,
  ConflictException,
  Controller,
  Get,
  Param,
  Post,
  Query,
  ServiceUnavailableException,
} from '@nestjs/common';
import { z } from 'zod';
import { Public } from '../../../src/http/authentication/public.decorator.js';
import { ProblemException } from '../../../src/http/problem-details/problem.exception.js';

export const probeBookSchema = z
  .object({
    title: z.string().min(1),
    pages: z.number().int().positive(),
    tags: z.array(z.string()).optional(),
  })
  .meta({ id: 'ProbeBook' });

export const probeListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50),
});

export const probeBookParamsSchema = z.object({
  id: z.uuid(),
});

type ProbeBook = z.infer<typeof probeBookSchema>;
type ProbeListQuery = z.infer<typeof probeListQuerySchema>;
type ProbeBookParams = z.infer<typeof probeBookParamsSchema>;

@Public()
@Controller('probe')
export class ProbeController {
  @Post('books')
  create(@Body({ schema: probeBookSchema }) book: ProbeBook): ProbeBook {
    return book;
  }

  @Get('books')
  list(@Query({ schema: probeListQuerySchema }) query: ProbeListQuery): ProbeListQuery {
    return query;
  }

  @Get('books/:id')
  find(@Param({ schema: probeBookParamsSchema }) params: ProbeBookParams): ProbeBookParams {
    return params;
  }

  @Get('conflict')
  conflict(): Promise<never> {
    return Promise.reject(new ConflictException('The book is already on the shelf.'));
  }

  @Get('problem')
  problem(): Promise<never> {
    return Promise.reject(
      new ProblemException({
        status: 409,
        code: 'book_already_finished',
        detail: 'The book is already finished.',
      }),
    );
  }

  @Get('problem-unavailable')
  problemUnavailable(): Promise<never> {
    return Promise.reject(
      new ProblemException({
        status: 503,
        code: 'catalogue_unavailable',
        detail: 'open library at 10.0.0.7:8080 timed out',
        errors: [{ path: 'upstream', message: 'host 10.0.0.7 refused', code: 'upstream_down' }],
      }),
    );
  }

  @Get('unavailable')
  unavailable(): Promise<never> {
    return Promise.reject(new ServiceUnavailableException('redis at 10.0.0.3:6379 is down'));
  }

  @Get('crash')
  crash(): Promise<never> {
    return Promise.reject(new Error('connection to postgres://libro:secret@db failed'));
  }
}
