import { describe, expect } from 'vitest';
import { integrationTest } from './support/integration-test.js';
import { ProbeModule } from './support/probe/probe.module.js';

const test = integrationTest({ imports: [ProbeModule] });

type SecurityRequirement = Record<string, string[]>;

interface OpenApiDocument {
  paths: Record<string, Record<string, OpenApiOperation>>;
  security?: SecurityRequirement[];
  components: {
    schemas: Record<string, { properties?: Record<string, unknown> }>;
    securitySchemes?: Record<string, unknown>;
  };
}

interface OpenApiOperation {
  security?: SecurityRequirement[];
  parameters?: { name: string; in: string; required?: boolean; schema?: unknown }[];
  requestBody?: { content: Record<string, { schema: unknown }> };
  responses: Record<string, { content?: Record<string, { schema: unknown }> }>;
}

describe('OpenAPI', () => {
  test('serves the Swagger UI', async ({ http }) => {
    const response = await http.get('/docs').redirects(1);

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toMatch(/^text\/html/);
  });

  test('serves the document with the health and versioned paths', async ({ http }) => {
    const response = await http.get('/docs-json');
    const document = response.body as OpenApiDocument;

    expect(response.status).toBe(200);
    expect(Object.keys(document.paths)).toEqual(
      expect.arrayContaining(['/health', '/v1/probe/books', '/v1/probe/books/{id}']),
    );
    expect(document.paths['/health']?.get?.responses).toHaveProperty('200');
    expect(document.paths['/health']?.get?.responses).toHaveProperty('503');
  });

  test('describes zod request schemas', async ({ http }) => {
    const document = (await http.get('/docs-json')).body as OpenApiDocument;
    const books = document.paths['/v1/probe/books'];

    expect(books?.post?.requestBody?.content['application/json']?.schema).toEqual({
      $ref: '#/components/schemas/ProbeBook',
    });
    expect(document.components.schemas.ProbeBook?.properties).toHaveProperty('title');
    expect(books?.get?.parameters?.filter((parameter) => parameter.in === 'query')).toEqual([
      expect.objectContaining({ name: 'limit', in: 'query', required: true }),
    ]);
  });

  test('describes the books endpoints with their zod schemas', async ({ http }) => {
    const document = (await http.get('/docs-json')).body as OpenApiDocument;
    const books = document.paths['/v1/books'];
    const book = document.paths['/v1/books/{workId}'];

    expect(books?.post?.requestBody?.content['application/json']?.schema).toEqual({
      $ref: '#/components/schemas/AddBook',
    });
    expect(books?.post?.responses['201']?.content?.['application/json']?.schema).toEqual({
      $ref: '#/components/schemas/Book',
    });
    expect(book?.get?.parameters?.filter((parameter) => parameter.in === 'path')).toEqual([
      expect.objectContaining({ name: 'workId', in: 'path', required: true }),
    ]);
    expect(book?.get?.responses['200']?.content?.['application/json']?.schema).toEqual({
      $ref: '#/components/schemas/Book',
    });
  });

  test('documents the optional app headers and the 426 answer on every operation', async ({
    http,
  }) => {
    const document = (await http.get('/docs-json')).body as OpenApiDocument;
    const operations = [document.paths['/health']?.get, document.paths['/v1/probe/books']?.post];

    for (const operation of operations) {
      expect(operation?.parameters).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'X-App-Version', in: 'header', required: false }),
          expect.objectContaining({
            name: 'X-Platform',
            in: 'header',
            required: false,
            schema: { type: 'string', enum: ['ios', 'android'] },
          }),
        ]),
      );
      expect(operation?.responses['426']?.content).toEqual({
        'application/problem+json': { schema: { $ref: '#/components/schemas/ProblemDetails' } },
      });
    }
  });

  test('documents the problem details error schema on every operation', async ({ http }) => {
    const document = (await http.get('/docs-json')).body as OpenApiDocument;

    expect(Object.keys(document.components.schemas.ProblemDetails?.properties ?? {})).toEqual([
      'type',
      'title',
      'status',
      'detail',
      'instance',
      'code',
      'errors',
    ]);
    expect(document.paths['/v1/probe/books']?.post?.responses.default?.content).toEqual({
      'application/problem+json': { schema: { $ref: '#/components/schemas/ProblemDetails' } },
    });
  });

  test('describes the auth endpoints with their zod schemas', async ({ http }) => {
    const document = (await http.get('/docs-json')).body as OpenApiDocument;
    const register = document.paths['/v1/auth/register']?.post;
    const login = document.paths['/v1/auth/login']?.post;
    const me = document.paths['/v1/me']?.get;

    expect(register?.requestBody?.content['application/json']?.schema).toEqual({
      $ref: '#/components/schemas/Register',
    });
    expect(register?.responses['201']?.content?.['application/json']?.schema).toEqual({
      $ref: '#/components/schemas/AuthSession',
    });
    expect(login?.requestBody?.content['application/json']?.schema).toEqual({
      $ref: '#/components/schemas/Login',
    });
    expect(login?.responses['200']?.content?.['application/json']?.schema).toEqual({
      $ref: '#/components/schemas/AuthSession',
    });
    expect(me?.responses['200']?.content?.['application/json']?.schema).toEqual({
      $ref: '#/components/schemas/User',
    });
    for (const path of ['/v1/auth/refresh', '/v1/auth/logout']) {
      expect(document.paths[path]?.post?.requestBody?.content['application/json']?.schema).toEqual({
        $ref: '#/components/schemas/RefreshTokenRequest',
      });
    }
    expect(
      document.paths['/v1/auth/refresh']?.post?.responses['200']?.content?.['application/json']
        ?.schema,
    ).toEqual({ $ref: '#/components/schemas/AuthSession' });
    expect(document.paths['/v1/auth/logout']?.post?.responses).toHaveProperty('204');
  });

  test('requires the bearer token by default and lets public operations opt out', async ({
    http,
  }) => {
    const document = (await http.get('/docs-json')).body as OpenApiDocument;
    const operation = (path: string, method: string) => document.paths[path]?.[method];

    expect(document.components.securitySchemes).toEqual({
      bearer: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    });
    expect(document.security).toEqual([{ bearer: [] }]);
    expect(
      [
        operation('/v1/me', 'get'),
        operation('/v1/books', 'post'),
        operation('/v1/books/{workId}', 'get'),
        operation('/v1/probe/protected', 'get'),
      ].map((protectedOperation) => protectedOperation?.security),
    ).toEqual([undefined, undefined, undefined, undefined]);
    expect(
      [
        operation('/health', 'get'),
        operation('/v1/auth/register', 'post'),
        operation('/v1/auth/login', 'post'),
        operation('/v1/auth/refresh', 'post'),
        operation('/v1/auth/logout', 'post'),
        operation('/v1/probe/books', 'get'),
      ].map((publicOperation) => publicOperation?.security),
    ).toEqual([[{}], [{}], [{}], [{}], [{}], [{}]]);
  });
});
