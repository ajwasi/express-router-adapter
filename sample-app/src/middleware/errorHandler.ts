export function errorHandler(err: any, req: any, res: any, next: any): void { // eslint-disable-line no-unused-vars

  const { status = 500 } = err;
  // never send server error messages to callers: they can contain connection strings, SQL, file paths...
  const message = status >= 500 ? 'Server Error' : err.message;
  if (status >= 500) {
    console.log('failed to process request', req.method, req.path);
    console.error('error handler error', err);
  }

  let requestLogMessage = `${status} ${req.method} ${req.url}`;
  if (req.expressRouterAdapter && req.expressRouterAdapter.securityContext) {
    requestLogMessage += ` (${req.expressRouterAdapter.securityContext.toLogSafeString()})`;
  }

  console.log(requestLogMessage);

  res.status(status)
    .json({
      status,
      message
    });
}
