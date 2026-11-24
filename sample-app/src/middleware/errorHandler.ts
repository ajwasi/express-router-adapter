// Strip control characters (CR/LF etc.) so user-controlled values can't forge log lines.
const sanitize = (value: unknown): string => String(value).replace(/[\u0000-\u001f\u007f]/g, '_');

export function errorHandler(err: any, req: any, res: any, next: any): void { // eslint-disable-line no-unused-vars

  const {
    status = 500,
    message = 'Server Error'
  } = err;
  if (status >= 500) {
    console.log('failed to process request', sanitize(req.method), sanitize(req.path));
    console.error('error handler error', err);
  }

  let requestLogMessage = `${status} ${sanitize(req.method)} ${sanitize(req.url)}`;
  if (req.expressRouterAdapter && req.expressRouterAdapter.securityContext) {
    requestLogMessage += ` (${sanitize(req.expressRouterAdapter.securityContext.toLogSafeString())})`;
  }

  console.log(requestLogMessage);

  res.status(status)
    .json({
      status,
      message
    });
}
