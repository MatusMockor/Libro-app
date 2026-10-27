import { ConsoleLogger, type LoggerService } from '@nestjs/common';
import { describe, expect, onTestFinished, vi } from 'vitest';

vi.stubEnv('MIN_APP_VERSION_IOS', '2.0.0');
vi.stubEnv('MIN_APP_VERSION_ANDROID', '1.9.0');

const { integrationTest } = await import('./support/integration-test.js');
const { ProbeModule } = await import('./support/probe/probe.module.js');

const test = integrationTest({ imports: [ProbeModule] });

const ROUTE = '/v1/probe/books?limit=5';

const PROBLEM_JSON = /^application\/problem\+json(;|$)/;

interface ClientProblem {
  status: number;
  code: string;
  detail: string;
}

class CapturingLogger implements LoggerService {
  readonly messages: string[] = [];

  log(message: unknown): void {
    this.messages.push(String(message));
  }

  warn(): void {}

  error(): void {}

  clientLines(): string[] {
    return this.messages.filter((message) => message.startsWith('client '));
  }
}

describe('app version check', () => {
  test('lets a request without app headers through', async ({ http }) => {
    const response = await http.get(ROUTE);

    expect(response.status).toBe(200);
  });

  test.for([
    { platform: 'ios', version: '2.0.0' },
    { platform: 'ios', version: '2.0.1' },
    { platform: 'ios', version: '10.0.0' },
    { platform: 'android', version: '1.9.0' },
    { platform: 'android', version: '1.10.0' },
    { platform: 'ANDROID', version: '1.9.0' },
  ])('lets $platform $version through', async ({ platform, version }, { http }) => {
    const response = await http
      .get(ROUTE)
      .set('X-Platform', platform)
      .set('X-App-Version', version);

    expect(response.status).toBe(200);
  });

  test('answers an outdated version with 426 problem details', async ({ http }) => {
    const response = await http.get(ROUTE).set('X-Platform', 'ios').set('X-App-Version', '1.99.9');

    expect(response.status).toBe(426);
    expect(response.headers['content-type']).toMatch(PROBLEM_JSON);
    expect(response.body).toStrictEqual({
      type: 'about:blank',
      title: 'Upgrade Required',
      status: 426,
      detail: 'This app version is no longer supported. Update to 2.0.0 or newer.',
      instance: '/v1/probe/books',
      code: 'app_update_required',
    });
  });

  test('compares versions numerically per component', async ({ http }) => {
    const response = await http
      .get(ROUTE)
      .set('X-Platform', 'android')
      .set('X-App-Version', '1.8.10');
    const body = response.body as ClientProblem;

    expect(response.status).toBe(426);
    expect(body.detail).toBe('This app version is no longer supported. Update to 1.9.0 or newer.');
  });

  test('applies the minimum of the client platform only', async ({ http }) => {
    const android = await http
      .get(ROUTE)
      .set('X-Platform', 'android')
      .set('X-App-Version', '1.9.5');
    const ios = await http.get(ROUTE).set('X-Platform', 'ios').set('X-App-Version', '1.9.5');

    expect(android.status).toBe(200);
    expect(ios.status).toBe(426);
  });

  test.for([
    {
      name: 'only X-App-Version',
      headers: { 'X-App-Version': '2.0.0' },
      detail: 'The X-Platform header is required with X-App-Version.',
    },
    {
      name: 'only X-Platform',
      headers: { 'X-Platform': 'ios' },
      detail: 'The X-App-Version header is required with X-Platform.',
    },
    {
      name: 'an unknown platform',
      headers: { 'X-Platform': 'windows', 'X-App-Version': '2.0.0' },
      detail: 'X-Platform must be one of: ios, android.',
    },
    {
      name: 'a version with a prefix',
      headers: { 'X-Platform': 'ios', 'X-App-Version': 'v2.0.0' },
      detail: 'X-App-Version must be a version like 1.4.0.',
    },
    {
      name: 'a version without a patch',
      headers: { 'X-Platform': 'ios', 'X-App-Version': '2.0' },
      detail: 'X-App-Version must be a version like 1.4.0.',
    },
    {
      name: 'a pre-release version',
      headers: { 'X-Platform': 'ios', 'X-App-Version': '2.0.0-beta.1' },
      detail: 'X-App-Version must be a version like 1.4.0.',
    },
  ])('rejects $name with 400 invalid_app_client', async ({ headers, detail }, { http }) => {
    const response = await http.get(ROUTE).set(headers);

    expect(response.status).toBe(400);
    expect(response.headers['content-type']).toMatch(PROBLEM_JSON);
    expect(response.body).toStrictEqual({
      type: 'about:blank',
      title: 'Bad Request',
      status: 400,
      detail,
      instance: '/v1/probe/books',
      code: 'invalid_app_client',
    });
  });

  test('checks version neutral routes too', async ({ http }) => {
    const response = await http
      .get('/health')
      .set('X-Platform', 'ios')
      .set('X-App-Version', '1.0.0');
    const body = response.body as ClientProblem;

    expect(response.status).toBe(426);
    expect(body.code).toBe('app_update_required');
  });

  test('does not check the OpenAPI docs', async ({ http }) => {
    const response = await http
      .get('/docs-json')
      .set('X-Platform', 'ios')
      .set('X-App-Version', '1.0.0');

    expect(response.status).toBe(200);
  });

  test('keeps answering 404 for unknown routes', async ({ http }) => {
    const response = await http
      .get('/v1/no-such-route')
      .set('X-Platform', 'ios')
      .set('X-App-Version', '1.0.0');

    expect(response.status).toBe(404);
  });

  test('logs the client of every app request with its outcome', async ({ app, http }) => {
    const logger = new CapturingLogger();
    app.useLogger(logger);
    onTestFinished(() => {
      app.useLogger(new ConsoleLogger());
    });

    await http.get(ROUTE).set('X-Platform', 'ios').set('X-App-Version', '2.1.0');
    await http.get(ROUTE).set('X-Platform', 'Android').set('X-App-Version', '1.2.3');
    await http.get(ROUTE);
    await http.get(ROUTE).set('X-Platform', 'ios').set('X-App-Version', 'nope');

    expect(logger.clientLines()).toEqual([
      'client platform=ios version=2.1.0 outcome=accepted',
      'client platform=android version=1.2.3 outcome=outdated',
      'client platform=unknown version=unknown outcome=invalid',
    ]);
  });
});
