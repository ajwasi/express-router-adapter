import * as express from 'express';

export function bootMiddleware(app: any): void {
  // express.json is built in to express 4.16+ and 5, so body-parser is no longer needed.
  app.use(express.json({
    type: [
      'application/json',
      '+json'
    ],
    limit: '50mb'
  }));
}
