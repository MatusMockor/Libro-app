import { HttpStatus } from '@nestjs/common';
import { ProblemException } from '../../../http/problem-details/problem.exception.js';

export class TreeEngineVersionUnavailableException extends ProblemException {
  constructor(readingId: string, version: number | undefined) {
    super({
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'tree_engine_version_unavailable',
      detail: `Reading ${readingId} has tree engine version ${String(version)}, which this server cannot compute.`,
    });
  }
}
