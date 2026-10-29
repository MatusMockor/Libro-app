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
    expect(books?.get?.parameters?.filter((parameter) => parameter.in === 'query')).toEqual([
      expect.objectContaining({ name: 'q', in: 'query', required: true }),
      expect.objectContaining({ name: 'limit', in: 'query', required: false }),
      expect.objectContaining({ name: 'offset', in: 'query', required: false }),
    ]);
    expect(books?.get?.responses['200']?.content?.['application/json']?.schema).toEqual({
      $ref: '#/components/schemas/BookSearch',
    });
    expect(Object.keys(document.components.schemas.BookSearch?.properties ?? {})).toEqual([
      'items',
      'nextOffset',
    ]);
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
    expect(
      document.paths['/v1/auth/google/nonce']?.post?.responses['201']?.content?.['application/json']
        ?.schema,
    ).toEqual({ $ref: '#/components/schemas/SignInNonce' });
    expect(
      document.paths['/v1/auth/google']?.post?.requestBody?.content['application/json']?.schema,
    ).toEqual({ $ref: '#/components/schemas/IdentityTokenRequest' });
    expect(
      document.paths['/v1/auth/google']?.post?.responses['200']?.content?.['application/json']
        ?.schema,
    ).toEqual({ $ref: '#/components/schemas/AuthSession' });
  });

  test('describes the reading-sessions endpoints with their zod schemas', async ({ http }) => {
    const document = (await http.get('/docs-json')).body as OpenApiDocument;
    const okSchema = (path: string, method: string, status: string) =>
      document.paths[path]?.[method]?.responses[status]?.content?.['application/json']?.schema;
    const requestSchema = (path: string) =>
      document.paths[path]?.post?.requestBody?.content['application/json']?.schema;
    const session = { $ref: '#/components/schemas/ReadingSession' };

    expect(requestSchema('/v1/reading-sessions')).toEqual({
      $ref: '#/components/schemas/StartReadingSession',
    });
    expect(okSchema('/v1/reading-sessions', 'post', '201')).toEqual(session);
    expect(okSchema('/v1/reading-sessions/current', 'get', '200')).toEqual(session);
    for (const path of ['', '/pause', '/resume', '/end']) {
      const method = path === '' ? 'get' : 'post';
      expect(okSchema(`/v1/reading-sessions/{sessionId}${path}`, method, '200')).toEqual(session);
    }
    expect(requestSchema('/v1/reading-sessions/{sessionId}/checkpoints')).toEqual({
      $ref: '#/components/schemas/AddCheckpoint',
    });
    expect(okSchema('/v1/reading-sessions/{sessionId}/checkpoints', 'post', '201')).toEqual({
      $ref: '#/components/schemas/Checkpoint',
    });
    expect(requestSchema('/v1/reading-sessions/{sessionId}/marked-parts')).toEqual({
      $ref: '#/components/schemas/MarkPart',
    });
    expect(okSchema('/v1/reading-sessions/{sessionId}/marked-parts', 'post', '201')).toEqual({
      $ref: '#/components/schemas/MarkedPart',
    });
    expect(okSchema('/v1/readings/{readingId}/finish', 'post', '200')).toEqual({
      $ref: '#/components/schemas/Reading',
    });
    expect(Object.keys(document.components.schemas.ReadingSession?.properties ?? {})).toEqual([
      'id',
      'readingId',
      'workId',
      'place',
      'status',
      'startedAt',
      'endedAt',
      'activeSeconds',
      'checkpoints',
      'markedParts',
    ]);
  });

  test('describes the tree endpoints with their zod schemas', async ({ http }) => {
    const document = (await http.get('/docs-json')).body as OpenApiDocument;
    const okSchema = (path: string) =>
      document.paths[path]?.get?.responses['200']?.content?.['application/json']?.schema;
    const queryNames = (path: string) =>
      document.paths[path]?.get?.parameters
        ?.filter((parameter) => parameter.in === 'query')
        .map(({ name }) => name);
    const page = { $ref: '#/components/schemas/ReadingTreePage' };

    expect(okSchema('/v1/readings/{readingId}/tree')).toEqual({
      $ref: '#/components/schemas/ReadingTree',
    });
    expect(okSchema('/v1/me/forest')).toEqual(page);
    expect(okSchema('/v1/me/growing-trees')).toEqual(page);
    expect(queryNames('/v1/me/forest')).toEqual(['limit', 'offset']);
    expect(queryNames('/v1/me/growing-trees')).toEqual(['limit', 'offset']);
    expect(Object.keys(document.components.schemas.ReadingTree?.properties ?? {})).toEqual([
      'readingId',
      'workId',
      'finished',
      'finishedAt',
      'tree',
    ]);
    expect(Object.keys(document.components.schemas.TreeV1?.properties ?? {})).toEqual([
      'treeEngineVersion',
      'stage',
      'growth',
      'trunk',
      'branches',
      'leaves',
      'flowers',
      'fruits',
      'decorations',
      'stats',
    ]);
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
        operation('/v1/books', 'get'),
        operation('/v1/books/{workId}', 'get'),
        operation('/v1/reading-sessions', 'post'),
        operation('/v1/readings/{readingId}/finish', 'post'),
        operation('/v1/readings/{readingId}/tree', 'get'),
        operation('/v1/me/forest', 'get'),
        operation('/v1/me/growing-trees', 'get'),
        operation('/v1/probe/protected', 'get'),
      ].map((protectedOperation) => protectedOperation?.security),
    ).toEqual(Array.from({ length: 10 }, () => undefined));
    expect(
      [
        operation('/health', 'get'),
        operation('/v1/auth/register', 'post'),
        operation('/v1/auth/login', 'post'),
        operation('/v1/auth/refresh', 'post'),
        operation('/v1/auth/logout', 'post'),
        operation('/v1/auth/google/nonce', 'post'),
        operation('/v1/auth/google', 'post'),
        operation('/v1/probe/books', 'get'),
      ].map((publicOperation) => publicOperation?.security),
    ).toEqual([[{}], [{}], [{}], [{}], [{}], [{}], [{}], [{}]]);
  });
});
