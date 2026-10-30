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
    expect(
      document.paths['/v1/me/deletion']?.post?.requestBody?.content['application/json']?.schema,
    ).toEqual({ $ref: '#/components/schemas/AccountDeletionRequest' });
    expect(document.paths['/v1/me/deletion']?.post?.responses).toHaveProperty('204');
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

  test('describes the media endpoints with their zod schemas', async ({ http }) => {
    const document = (await http.get('/docs-json')).body as OpenApiDocument;
    const upload = document.paths['/v1/media']?.post;
    const media = document.paths['/v1/media/{mediaId}'];
    const file = document.paths['/v1/media/files/{key}']?.get;
    const mediaSchema = { $ref: '#/components/schemas/Media' };

    expect(upload?.requestBody?.content['multipart/form-data']?.schema).toEqual({
      type: 'object',
      required: ['file'],
      properties: {
        file: expect.objectContaining({ type: 'string', format: 'binary' }) as unknown,
      },
    });
    expect(upload?.responses['201']?.content?.['application/json']?.schema).toEqual(mediaSchema);
    expect(media?.get?.responses['200']?.content?.['application/json']?.schema).toEqual(
      mediaSchema,
    );
    expect(media?.get?.parameters?.filter((parameter) => parameter.in === 'path')).toEqual([
      expect.objectContaining({ name: 'mediaId', in: 'path', required: true }),
    ]);
    expect(media?.delete?.responses).toHaveProperty('204');
    expect(file?.parameters?.filter((parameter) => parameter.in !== 'header')).toEqual([
      expect.objectContaining({
        name: 'key',
        in: 'path',
        schema: expect.objectContaining({ type: 'string' }) as unknown,
      }),
      expect.objectContaining({ name: 'expires', in: 'query' }),
      expect.objectContaining({ name: 'signature', in: 'query' }),
    ]);
    expect(file?.responses['200']?.content).toEqual({
      'image/webp': { schema: { type: 'string', format: 'binary' } },
    });
    expect(Object.keys(document.components.schemas.Media?.properties ?? {})).toEqual([
      'id',
      'width',
      'height',
      'createdAt',
      'variants',
      'urlsExpireAt',
    ]);
  });

  test('describes the profiles endpoints with their zod schemas', async ({ http }) => {
    const document = (await http.get('/docs-json')).body as OpenApiDocument;
    const okSchema = (path: string, method = 'get') =>
      document.paths[path]?.[method]?.responses['200']?.content?.['application/json']?.schema;
    const pathNames = (path: string, method = 'get') =>
      document.paths[path]?.[method]?.parameters
        ?.filter((parameter) => parameter.in === 'path')
        .map(({ name }) => name);
    const queryNames = (path: string) =>
      document.paths[path]?.get?.parameters
        ?.filter((parameter) => parameter.in === 'query')
        .map(({ name }) => name);
    const profile = { $ref: '#/components/schemas/Profile' };
    const page = { $ref: '#/components/schemas/ProfileSummaryPage' };

    expect(okSchema('/v1/me/profile')).toEqual(profile);
    expect(
      document.paths['/v1/me/profile']?.patch?.requestBody?.content['application/json']?.schema,
    ).toEqual({ $ref: '#/components/schemas/UpdateProfile' });
    expect(okSchema('/v1/me/profile', 'patch')).toEqual(profile);
    expect(okSchema('/v1/profiles')).toEqual(page);
    expect(queryNames('/v1/profiles')).toEqual(['q', 'limit', 'offset']);
    expect(okSchema('/v1/profiles/genres')).toEqual({
      $ref: '#/components/schemas/ProfileGenres',
    });
    expect(okSchema('/v1/profiles/{userId}')).toEqual(profile);
    expect(pathNames('/v1/profiles/{userId}')).toEqual(['userId']);
    expect(okSchema('/v1/profiles/by-handle/{handle}')).toEqual(profile);
    expect(pathNames('/v1/profiles/by-handle/{handle}')).toEqual(['handle']);
    for (const list of ['followers', 'following']) {
      expect(okSchema(`/v1/profiles/{userId}/${list}`)).toEqual(page);
      expect(queryNames(`/v1/profiles/{userId}/${list}`)).toEqual(['limit', 'offset']);
    }
    expect(document.paths['/v1/profiles/{userId}/follow']?.put?.responses).toHaveProperty('204');
    expect(document.paths['/v1/profiles/{userId}/follow']?.delete?.responses).toHaveProperty('204');
    expect(Object.keys(document.components.schemas.Profile?.properties ?? {})).toEqual([
      'userId',
      'handle',
      'displayName',
      'bio',
      'favouriteGenres',
      'topBooks',
      'avatar',
      'followerCount',
      'followingCount',
      'followedByMe',
    ]);
    expect(Object.keys(document.components.schemas.ProfileSummary?.properties ?? {})).toEqual([
      'userId',
      'handle',
      'displayName',
      'avatar',
      'followedByMe',
    ]);
    expect(Object.keys(document.components.schemas.UpdateProfile?.properties ?? {})).toEqual([
      'handle',
      'displayName',
      'bio',
      'favouriteGenres',
      'topBookIds',
      'avatarMediaId',
    ]);
  });

  test('describes the feed endpoints with their zod schemas', async ({ http }) => {
    const document = (await http.get('/docs-json')).body as OpenApiDocument;
    const content = (path: string, method: string, status: string) =>
      document.paths[path]?.[method]?.responses[status]?.content?.['application/json']?.schema;
    const parameterNames = (path: string, method: string, location: string) =>
      document.paths[path]?.[method]?.parameters
        ?.filter((parameter) => parameter.in === location)
        .map(({ name }) => name);
    const post = { $ref: '#/components/schemas/Post' };
    const page = { $ref: '#/components/schemas/PostPage' };

    expect(
      document.paths['/v1/posts']?.post?.requestBody?.content['application/json']?.schema,
    ).toEqual({ $ref: '#/components/schemas/CreatePost' });
    expect(content('/v1/posts', 'post', '201')).toEqual(post);
    expect(content('/v1/posts', 'get', '200')).toEqual(page);
    expect(parameterNames('/v1/posts', 'get', 'query')).toEqual(['authorId', 'cursor', 'limit']);
    expect(content('/v1/posts/{postId}', 'get', '200')).toEqual(post);
    expect(parameterNames('/v1/posts/{postId}', 'get', 'path')).toEqual(['postId']);
    expect(document.paths['/v1/posts/{postId}']?.delete?.responses).toHaveProperty('204');
    for (const method of ['put', 'delete']) {
      expect(document.paths['/v1/posts/{postId}/like']?.[method]?.responses).toHaveProperty('204');
      expect(
        document.paths['/v1/posts/{postId}/reactions/{reaction}']?.[method]?.responses,
      ).toHaveProperty('204');
      expect(parameterNames('/v1/posts/{postId}/reactions/{reaction}', method, 'path')).toEqual([
        'postId',
        'reaction',
      ]);
    }
    expect(content('/v1/posts/{postId}/reactions', 'get', '200')).toEqual({
      $ref: '#/components/schemas/PostReactionPage',
    });
    expect(parameterNames('/v1/posts/{postId}/reactions', 'get', 'query')).toEqual([
      'cursor',
      'limit',
    ]);
    for (const feed of ['following', 'community']) {
      expect(content(`/v1/feed/${feed}`, 'get', '200')).toEqual(page);
      expect(parameterNames(`/v1/feed/${feed}`, 'get', 'query')).toEqual(['cursor', 'limit']);
    }
    expect(content('/v1/feed/reactions', 'get', '200')).toEqual({
      $ref: '#/components/schemas/FeedReactions',
    });
    expect(Object.keys(document.components.schemas.Post?.properties ?? {})).toEqual([
      'id',
      'authorId',
      'author',
      'text',
      'book',
      'place',
      'createdAt',
      'likeCount',
      'likedByMe',
      'reactions',
      'photos',
    ]);
    expect(Object.keys(document.components.schemas.CreatePost?.properties ?? {})).toEqual([
      'text',
      'workId',
      'place',
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
        operation('/v1/media', 'post'),
        operation('/v1/media/{mediaId}', 'get'),
        operation('/v1/media/{mediaId}', 'delete'),
        operation('/v1/me/profile', 'get'),
        operation('/v1/me/profile', 'patch'),
        operation('/v1/profiles', 'get'),
        operation('/v1/profiles/genres', 'get'),
        operation('/v1/profiles/{userId}', 'get'),
        operation('/v1/profiles/by-handle/{handle}', 'get'),
        operation('/v1/profiles/{userId}/followers', 'get'),
        operation('/v1/profiles/{userId}/following', 'get'),
        operation('/v1/profiles/{userId}/follow', 'put'),
        operation('/v1/profiles/{userId}/follow', 'delete'),
        operation('/v1/posts', 'post'),
        operation('/v1/posts', 'get'),
        operation('/v1/posts/{postId}', 'get'),
        operation('/v1/posts/{postId}', 'delete'),
        operation('/v1/posts/{postId}/like', 'put'),
        operation('/v1/posts/{postId}/like', 'delete'),
        operation('/v1/posts/{postId}/reactions', 'get'),
        operation('/v1/posts/{postId}/reactions/{reaction}', 'put'),
        operation('/v1/posts/{postId}/reactions/{reaction}', 'delete'),
        operation('/v1/feed/following', 'get'),
        operation('/v1/feed/community', 'get'),
        operation('/v1/feed/reactions', 'get'),
        operation('/v1/probe/protected', 'get'),
      ].map((protectedOperation) => protectedOperation?.security),
    ).toEqual(Array.from({ length: 35 }, () => undefined));
    expect(
      [
        operation('/health', 'get'),
        operation('/v1/auth/register', 'post'),
        operation('/v1/auth/login', 'post'),
        operation('/v1/auth/refresh', 'post'),
        operation('/v1/auth/logout', 'post'),
        operation('/v1/auth/google/nonce', 'post'),
        operation('/v1/auth/google', 'post'),
        operation('/v1/media/files/{key}', 'get'),
        operation('/v1/probe/books', 'get'),
      ].map((publicOperation) => publicOperation?.security),
    ).toEqual([[{}], [{}], [{}], [{}], [{}], [{}], [{}], [{}], [{}]]);
  });
});
