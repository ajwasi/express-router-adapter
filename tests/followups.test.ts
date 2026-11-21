import request from 'supertest';
import express from 'express';
import assert from 'assert';
import http from 'http';
import {
  ExpressRouterAdapter,
  ExpressRouterAdapterConfig,
  HTTPError,
  HTTPResponse,
  RouterMetaBuilder
} from '../src';

const quietLog = { info() { /* noop */ }, debug() { /* noop */ } };

const noSecurity = {
  async getSecurityContext(): Promise<any> {
    return { toLogSafeString: () => 'anonymous' };
  }
};

function buildApp(routes: any[], { log = quietLog, config = {}, provider = noSecurity as any } = {}) {
  const app = express();
  app.use(express.json({ type: ['application/json', '+json'] }));
  new ExpressRouterAdapter(
    new ExpressRouterAdapterConfig({ TIMEOUT: 500, ...config }),
    { getRoutes: () => routes },
    provider,
    log
  ).applyRoutes(app);
  app.use((error, req, res, next) => {
    res.status(error.status || 500).json({ message: error.message });
  });
  return app;
}

const customFormatter = () => ({
  mediaType: 'application/a+json',
  formatForResponse: (model) => model,
  formatFromRequest: (body) => body
});

describe('review follow-ups', () => {

  describe('copies of responses', () => {
    it('keeps a spread copy of an HTTPResponse a real response', async () => {
      const app = buildApp([
        new RouterMetaBuilder().path('/b').allowAnonymous().get(() =>
          ({ ...new HTTPResponse({ status: 201, headers: { 'x-custom': 'yes' }, body: { created: true } }) }))
      ]);

      await request(app).get('/b').expect(201).expect('x-custom', 'yes').expect({ created: true });
    });

    it('keeps an Object.assign copy of an HTTPError a real response', async () => {
      const app = buildApp([
        new RouterMetaBuilder().path('/e').allowAnonymous().get(() =>
          Object.assign({}, new HTTPError({ status: 409, message: 'conflict', body: { conflict: true } })))
      ]);

      await request(app).get('/e').expect(409).expect({ conflict: true });
    });

    it('does not serialize the brand into the body', async () => {
      const app = buildApp([
        new RouterMetaBuilder().path('/b').allowAnonymous().get(() => new HTTPResponse({ status: 200, body: { a: 1 } }))
      ]);

      const res = await request(app).get('/b').expect(200);
      assert.deepStrictEqual(res.body, { a: 1 });
    });
  });

  describe('invalid responses', () => {
    it('does not send the headers of a response whose status is invalid', async () => {
      const app = buildApp([
        new RouterMetaBuilder().path('/a').allowAnonymous().get(() =>
          new HTTPResponse({ status: 'oops' as any, headers: { 'set-cookie': 'sid=abc', 'x-leak': '1' }, body: {} }))
      ]);

      const res = await request(app).get('/a').expect(500);
      assert.strictEqual(res.headers['set-cookie'], undefined);
      assert.strictEqual(res.headers['x-leak'], undefined);
    });
  });

  describe('client disconnect', () => {
    it('aborts the signal when the client goes away before the handler answers', async () => {
      let state = 'never';
      const app = buildApp([
        new RouterMetaBuilder().path('/d').allowAnonymous().get(async ({ signal }) => {
          signal.addEventListener('abort', () => { state = 'aborted'; });
          await new Promise((resolve) => setTimeout(resolve, 300));
          return {};
        })
      ]);
      const server = app.listen(0);
      try {
        const { port } = server.address() as any;
        await new Promise<void>((resolve) => {
          const req = http.get({ port, path: '/d' });
          req.on('error', () => undefined);
          setTimeout(() => { req.destroy(); resolve(); }, 80);
        });
        await new Promise((resolve) => setTimeout(resolve, 100));
        assert.strictEqual(state, 'aborted');
      } finally {
        server.close();
      }
    });

    it('does not abort the signal for a request that completes normally', async () => {
      let signal: any;
      const app = buildApp([
        new RouterMetaBuilder().path('/ok').allowAnonymous().get((params) => { signal = params.signal; return { ok: 1 }; })
      ]);

      await request(app).get('/ok').expect(200);
      await new Promise((resolve) => setTimeout(resolve, 50));
      assert.strictEqual(signal.aborted, false);
    });
  });

  describe('requests with no body behave the same on Express 4 and 5', () => {
    it('gives a pass through handler an empty object', async () => {
      const app = buildApp([
        new RouterMetaBuilder().path('/c').allowAnonymous().post(({ body }) => ({ body }))
      ]);

      await request(app).post('/c').expect(200).expect({ body: {} });
    });

    it('rejects a bodyless POST to a route with only custom media types with a 415', async () => {
      const app = buildApp([
        new RouterMetaBuilder().path('/c').allowAnonymous().mediaType(customFormatter()).post(() => ({ ok: 1 }))
      ]);

      await request(app).post('/c').set('accept', 'application/a+json').expect(415);
    });
  });

  describe('debug logging of headers', () => {
    const run = async (config = {}) => {
      const captured: any[] = [];
      const app = buildApp(
        [new RouterMetaBuilder().path('/l').allowAnonymous().post(() => ({}))],
        { log: { info() { /* noop */ }, debug: (...args) => captured.push(args) }, config }
      );
      await request(app)
        .post('/l')
        .set('user-agent', 'unit-test')
        .set('x-amz-security-token', 'SECRET-AWS')
        .set('x-goog-iap-jwt-assertion', 'SECRET-IAP')
        .send({});
      return JSON.stringify(captured);
    };

    it('logs allowlisted headers with values and everything else by name only', async () => {
      const logged = await run();
      assert.ok(logged.includes('unit-test'));
      assert.ok(!logged.includes('SECRET-AWS') && !logged.includes('SECRET-IAP'), logged);
      assert.ok(logged.includes('x-amz-security-token'), 'omitted headers should be listed by name');
    });

    it('lets the app choose which headers are logged', async () => {
      const logged = await run({ LOGGED_HEADERS: ['x-goog-iap-jwt-assertion'] });
      assert.ok(logged.includes('SECRET-IAP'));
      assert.ok(!logged.includes('unit-test'));
    });
  });

  describe('security contexts without a log-safe description', () => {
    it('still serves the request', async () => {
      const captured: any[] = [];
      const app = buildApp(
        [new RouterMetaBuilder().path('/s').get(() => ({ ok: 1 }))],
        {
          log: { info: (...args) => captured.push(args), debug() { /* noop */ } },
          provider: { async getSecurityContext() { return { principal: 'someone' }; } }
        }
      );

      await request(app).get('/s').expect(200).expect({ ok: 1 });
      assert.ok(JSON.stringify(captured).includes('no log-safe description'));
    });
  });
});
