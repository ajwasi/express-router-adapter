# Changelog

## 2.0.0

### Added
- Support for Express 5 (`peerDependencies.express` is now `^4.0.0 || ^5.0.0`). Tests run against both in CI.
- A response with no `status` is now defaulted (200 with a body, otherwise 204) instead of surfacing Express's
  `Invalid status code` error. A status that is set but is not an integer from 100 to 999 now fails with a message that says so.

### Security
- **Response envelope injection.** A handler that returned request data (for example an echoed body) could let a caller pick
  the response status and headers (`Location`, `Set-Cookie`) by including `"isHTTPResponse": true`. Envelopes are now
  recognized only for `HTTPResponse` / `HTTPError` instances or objects with a `send` function. **Behavior change:** a plain
  object literal with only `isHTTPResponse`, `status`, `headers` and `body` is now serialized as data. Use
  `new HTTPResponse({ ... })`.
- **Authentication now runs before formatters and media type checks.** Unauthenticated callers to a protected route now get a
  401 instead of a 406/415, and can no longer run `formatFromRequest` or learn supported media types.
- Handlers receive a `signal` (`AbortSignal`) that aborts on timeout, and a handler failing after a timeout no longer causes
  a second error.
- Debug logs redact credential headers and no longer log bodies; request logs use the path instead of the URL with its query
  string.
- Nested-object query values (for example `?name[$ne]=x` under Express 4's query parser) are rejected with a 400.
- A non GET request with no formatter matching `Accept` now returns 406 instead of a 500 `TypeError`.
- The 415 message no longer echoes the request's `Content-Type`.

### Changed
- **Breaking:** requires Node 18 or later (`engines`), matching Express 5. Compiled output now targets ES2020.
- `ISecurityContextProvider.getSecurityContext` is now typed as `(params: { req: any; [key: string]: any })`. The previous
  signature `({ req: any }: any)` renamed `req` to a variable called `any` and typed nothing. Existing implementations that
  accept `any` continue to compile.
- Replaced `proper-url-join` with a small internal `joinPaths` helper that returns identical results, removing a transitive
  vulnerable dependency (`decode-uri-component`). Also removed the `tslib` runtime dependency.
- Development tooling updated: TypeScript 5, mocha 10, ts-node 10, supertest 7, c8 (replaces nyc), ESLint (replaces the
  deprecated TSLint), typedoc 0.27.
- Sample app now runs on Express 5, uses `express.json` instead of `body-parser`, and `@codegenie/serverless-express`
  instead of the deprecated `aws-serverless-express`.

### Upgrading
Routes registered with Express 4-only path syntax (`*`, `?`, regex groups) must be rewritten. See "Express version support"
in the README.
