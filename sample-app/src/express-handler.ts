import { configure as serverlessExpress } from '@codegenie/serverless-express';
import { buildExpressApp } from './bootstrap';

// Build the app once per container and reuse it across warm invocations.
let cachedHandler: ReturnType<typeof serverlessExpress> | undefined;

// buildExpressApp should never throw, so there is no error handling here.
exports.handler = async (event, context, callback): Promise<any> => {
  if (!cachedHandler) {
    cachedHandler = serverlessExpress({ app: await buildExpressApp() });
  }
  return cachedHandler(event, context, callback);
};
