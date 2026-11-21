import request from 'supertest';
import express from 'express';
import assert from 'assert';
import {
  ExpressRouterAdapter,
  ExpressRouterAdapterConfig,
  HTTPResponse,
  Log,
  RouterMetaBuilder
} from '../src';

// A security context provider that treats any Authorization header as a principal (tests only, this is NOT real security).
class HeaderSecurityContextProvider {
  async getSecurityContext({ req }: any): Promise<any> {
    const principal = req.headers.authorization;
    return { principal, toLogSafeString: () => `principal:${principal ? 'yes' : 'no'}` };
  }
}

const quietLog = { info() { /* noop */ }, debug() { /* noop */ } };

function buildApp(routes: any[], { log = quietLog, timeout = 500, onError = (_e: any) => undefined as void } = {}) {
  const app = express();
  app.use(express.json({ type: ['application/json', '+json'] }));
  new ExpressRouterAdapter(
    new ExpressRouterAdapterConfig({ TIMEOUT: timeout }),
    { getRoutes: () => routes },
    new HeaderSecurityContextProvider() as any,
    log
  ).applyRoutes(app);
  app.use((error, req, res, next) => {
    onError(error);
    res.status(error.status || 500).json({ status: error.status || 500, message: error.message });
  });
  return app;
}

const jsonFormatter = (calls: { count: number } = { count: 0 }) => ({
  mediaType: 'application/vnd.test+json',
  formatForResponse: (model) => model,
  formatFromRequest: (body) => { calls.count++; return body; }
});

describe('security hardening', () => {

  describe('response envelope injection', () => {
    it('does not let a request body choose the response status or headers', async () => {
      const app = buildApp([
        new RouterMetaBuilder().path('/echo').allowAnonymous().post(({ body }) => body)
      ]);

      const res = await request(app).post('/echo').send({
        isHTTPResponse: true,
        status: 302,
        headers: { location: 'https://evil.example', 'set-cookie': 'session=attacker' },
        body: { ok: 1 }
      });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.headers.location, undefined);
      assert.strictEqual(res.headers['set-cookie'], undefined);
      // the forged envelope is just data: it comes back as the JSON body
      assert.strictEqual(res.body.isHTTPResponse, true);
    });

    it('does not let a formatter output that merely looks like an envelope set headers', async () => {
      const formatter = {
        mediaType: 'application/vnd.test+json',
        formatForResponse: (model) => model,
        formatFromRequest: (body) => body
      };
      const app = buildApp([
        new RouterMetaBuilder().path('/echo').allowAnonymous().mediaType(formatter).post(({ model }) => model)
      ]);

      const res = await request(app)
        .post('/echo')
        .set('content-type', 'application/vnd.test+json')
        .set('accept', 'application/vnd.test+json')
        .send({ isHTTPResponse: true, status: 302, headers: { location: 'https://evil.example' } });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.headers.location, undefined);
    });

    it('still honors real HTTPResponse instances', async () => {
      const app = buildApp([
        new RouterMetaBuilder().path('/ok').allowAnonymous().get(() =>
          new HTTPResponse({ status: 201, headers: { 'x-custom': 'yes' }, body: { created: true } }))
      ]);

      await request(app).get('/ok').expect(201).expect('x-custom', 'yes').expect({ created: true });
    });
  });

  describe('authentication happens before other work', () => {
    it('does not run request formatters for unauthenticated callers', async () => {
      const calls = { count: 0 };
      const app = buildApp([
        new RouterMetaBuilder().path('/secure').mediaType(jsonFormatter(calls)).post(() => ({ ok: 1 }))
      ]);

      await request(app)
        .post('/secure')
        .set('content-type', 'application/vnd.test+json')
        .send('{"a":1}')
        .expect(401);

      assert.strictEqual(calls.count, 0);
    });

    it('does not reveal supported media types to unauthenticated callers', async () => {
      const app = buildApp([
        new RouterMetaBuilder().path('/secure').mediaType(jsonFormatter()).post(() => ({ ok: 1 }))
      ]);

      const res = await request(app)
        .post('/secure')
        .set('content-type', 'application/json')
        .send('{"a":1}')
        .expect(401);

      assert.ok(!/vnd\.test/.test(res.body.message), res.body.message);
    });

    it('still runs formatters and the handler for authenticated callers', async () => {
      const calls = { count: 0 };
      const app = buildApp([
        new RouterMetaBuilder().path('/secure').mediaType(jsonFormatter(calls)).post(() => ({ ok: 1 }))
      ]);

      await request(app)
        .post('/secure')
        .set('authorization', 'user')
        .set('content-type', 'application/vnd.test+json')
        .set('accept', 'application/vnd.test+json')
        .send('{"a":1}')
        .expect(200)
        .expect({ ok: 1 });

      assert.strictEqual(calls.count, 1);
    });
  });

  describe('timeouts', () => {
    it('aborts the signal handed to the handler so it can stop before committing', async () => {
      let abortedWhenCheckedAfterWork: boolean | undefined;
      const app = buildApp([
        new RouterMetaBuilder().path('/slow').allowAnonymous().timeout(50).post(async ({ signal }) => {
          await new Promise((resolve) => setTimeout(resolve, 200));
          abortedWhenCheckedAfterWork = signal.aborted;
          return { done: true };
        })
      ]);

      await request(app).post('/slow').send({}).expect(503);
      await new Promise((resolve) => setTimeout(resolve, 300));

      assert.strictEqual(abortedWhenCheckedAfterWork, true);
    });

    it('does not report a second error when a handler fails after the timeout', async () => {
      const errors: any[] = [];
      const app = buildApp([
        new RouterMetaBuilder().path('/slow').allowAnonymous().timeout(50).get(async () => {
          await new Promise((resolve) => setTimeout(resolve, 150));
          throw new Error('late failure');
        })
      ], { onError: (e) => errors.push(e) });

      await request(app).get('/slow').expect(503);
      await new Promise((resolve) => setTimeout(resolve, 250));

      assert.strictEqual(errors.length, 1);
      assert.strictEqual(errors[0].status, 503);
    });
  });

  describe('logging', () => {
    const captured: any[] = [];
    const captureLog = {
      info: (...args) => captured.push(args),
      debug: (...args) => captured.push(args)
    };
    beforeEach(() => { captured.length = 0; });

    it('never logs credentials, request bodies or query strings', async () => {
      const app = buildApp([
        new RouterMetaBuilder().path('/l').allowAnonymous().post(() => ({}))
      ], { log: captureLog });

      await request(app)
        .post('/l?token=SECRET-QUERY')
        .set('authorization', 'Bearer SECRET-TOKEN')
        .set('cookie', 'sid=SECRET-COOKIE')
        .send({ password: 'SECRET-BODY' });

      const logged = JSON.stringify(captured);
      ['SECRET-QUERY', 'SECRET-TOKEN', 'SECRET-COOKIE', 'SECRET-BODY'].forEach((secret) => {
        assert.ok(!logged.includes(secret), `${secret} was logged`);
      });
      assert.ok(logged.includes('POST /l'), 'the request should still be logged');
    });

    it('the default logger does not change behavior', () => {
      assert.doesNotThrow(() => new Log().debug('x'));
    });
  });

  describe('query parameters', () => {
    const route = () => new RouterMetaBuilder().path('/q').allowAnonymous().query('name')
      .get(({ name }) => ({ kind: Array.isArray(name) ? 'array' : typeof name, name }));

    it('passes strings through', async () => {
      await request(buildApp([route()])).get('/q?name=a').expect(200).expect({ kind: 'string', name: 'a' });
    });

    it('passes repeated keys through as a list of strings', async () => {
      await request(buildApp([route()])).get('/q?name=a&name=b').expect(200).expect({ kind: 'array', name: ['a', 'b'] });
    });

    it('never hands a nested object to the handler', async () => {
      // Express 4's extended parser produces { $ne: 'x' } (rejected with 400); Express 5's simple parser never does.
      const res = await request(buildApp([route()])).get('/q?name[$ne]=x');
      assert.ok(res.status === 400 || res.body.kind === 'undefined', JSON.stringify(res.body));
      assert.notStrictEqual(res.body.kind, 'object');
    });
  });

  describe('error responses', () => {
    const formatter = () => ({
      mediaType: 'application/a+json',
      formatForResponse: (m) => m,
      formatFromRequest: (b) => b
    });

    it('returns 406 instead of an internal TypeError when no formatter matches Accept', async () => {
      const app = buildApp([
        new RouterMetaBuilder().path('/m').allowAnonymous().mediaType(formatter()).post(() => ({ created: 1 }))
      ]);

      const res = await request(app).post('/m').set('content-type', 'application/a+json').send('{"a":1}');

      assert.strictEqual(res.status, 406);
      assert.ok(!/undefined/.test(res.body.message), res.body.message);
    });

    it('does not reflect the request Content-Type header in the 415 message', async () => {
      const app = buildApp([
        new RouterMetaBuilder().path('/r').allowAnonymous().mediaType(formatter()).post(() => ({}))
      ]);

      const res = await request(app)
        .post('/r')
        .set('content-type', 'application/x-reflect-marker+json')
        .send('{"a":1}');

      assert.strictEqual(res.status, 415);
      assert.ok(!res.body.message.includes('reflect-marker'), res.body.message);
    });
  });
});
