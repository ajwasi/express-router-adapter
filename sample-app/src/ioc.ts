import 'reflect-metadata'; // Required by aurelia-dependency-injection

import { ISecurityContext, ISecurityContextProvider, RouteProvider, SecurityContextProvider } from '@ajwasi/express-router-adapter';
import { Container } from 'aurelia-dependency-injection';
import { ApplicationRouteProvider } from './ApplicationRouteProvider';

class ApplicationSecurityContext implements ISecurityContext {
  constructor(public principal: string) { }
  toLogSafeString(): string {
    return this.principal;
  }
}
// tslint:disable-next-line: max-classes-per-file
class ApplicationSecurityContextProvider implements ISecurityContextProvider {
  async getSecurityContext({ req }: any): Promise<ApplicationSecurityContext> {
    const authHeader = req.headers.authorization;
    // this is NOT real security: it trusts whatever the caller puts in the Authorization header as the user.
    // Never copy this. Verify a signed token (JWT, session, mTLS...) and return the verified principal.
    return new ApplicationSecurityContext(authHeader);
  }

}

export const getContainer = async (): Promise<Container> => {
  const container = new Container();

  container.registerAlias(ApplicationRouteProvider, RouteProvider);
  container.registerAlias(ApplicationSecurityContextProvider, SecurityContextProvider);

  return container;
};
