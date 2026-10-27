import type { INestApplication } from '@nestjs/common';
import {
  DocumentBuilder,
  SwaggerModule,
  type OpenAPIObject,
  type SchemaObject,
} from '@nestjs/swagger';
import { z } from 'zod';
import {
  PROBLEM_CONTENT_TYPE,
  problemDetailsSchema,
} from '../problem-details/problem-details.schema.js';

const OPENAPI_PATH = 'docs';

const PROBLEM_SCHEMA_NAME = 'ProblemDetails';

export function setupOpenApi(app: INestApplication): void {
  SwaggerModule.setup(OPENAPI_PATH, app, () => createDocument(app));
}

function createDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('read more API')
    .setVersion('1')
    .addGlobalResponse({
      status: 'default',
      description: 'Error (RFC 9457 Problem Details)',
      content: {
        [PROBLEM_CONTENT_TYPE]: { schema: { $ref: `#/components/schemas/${PROBLEM_SCHEMA_NAME}` } },
      },
    })
    .build();
  const document = SwaggerModule.createDocument(app, config);

  return {
    ...document,
    components: {
      ...document.components,
      schemas: {
        ...document.components?.schemas,
        [PROBLEM_SCHEMA_NAME]: problemDetailsComponent(),
      },
    },
  };
}

function problemDetailsComponent(): SchemaObject {
  return z.toJSONSchema(problemDetailsSchema, { target: 'openapi-3.0' }) as SchemaObject;
}
