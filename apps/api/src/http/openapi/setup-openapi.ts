import type { INestApplication } from '@nestjs/common';
import {
  DocumentBuilder,
  SwaggerModule,
  type OpenAPIObject,
  type SchemaObject,
} from '@nestjs/swagger';
import { z } from 'zod';
import { APP_VERSION_HEADER, PLATFORM_HEADER } from '../app-version/app-client-headers.js';
import { APP_PLATFORMS } from '../app-version/app-platform.js';
import { APP_VERSION_PATTERN } from '../../shared/app-version.js';
import {
  PROBLEM_CONTENT_TYPE,
  problemDetailsSchema,
} from '../problem-details/problem-details.schema.js';

const OPENAPI_PATH = 'docs';

const BEARER_SCHEME = 'bearer';

const PROBLEM_SCHEMA_NAME = 'ProblemDetails';

const PROBLEM_CONTENT = {
  [PROBLEM_CONTENT_TYPE]: { schema: { $ref: `#/components/schemas/${PROBLEM_SCHEMA_NAME}` } },
};

export function setupOpenApi(app: INestApplication): void {
  SwaggerModule.setup(OPENAPI_PATH, app, () => createDocument(app));
}

function createDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('read more API')
    .setVersion('1')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, BEARER_SCHEME)
    .addSecurityRequirements(BEARER_SCHEME)
    .addGlobalParameters(
      {
        name: APP_VERSION_HEADER,
        in: 'header',
        required: false,
        description: `Version of the app, sent together with ${PLATFORM_HEADER}`,
        schema: { type: 'string', pattern: APP_VERSION_PATTERN.source },
      },
      {
        name: PLATFORM_HEADER,
        in: 'header',
        required: false,
        description: `Platform of the app, sent together with ${APP_VERSION_HEADER}`,
        schema: { type: 'string', enum: [...APP_PLATFORMS] },
      },
    )
    .addGlobalResponse(
      {
        status: 426,
        description: 'The app version is no longer supported (code app_update_required)',
        content: PROBLEM_CONTENT,
      },
      {
        status: 'default',
        description: 'Error (RFC 9457 Problem Details)',
        content: PROBLEM_CONTENT,
      },
    )
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
