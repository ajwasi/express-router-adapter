import { ISecurityContextProvider } from './ISecurityContextProvider';
import { ISecurityContext } from './ISecurityContext';

export class SecurityContextProvider implements ISecurityContextProvider {
    async getSecurityContext(_params: { req: any; [key: string]: any }): Promise<ISecurityContext> {
        return {
          toLogSafeString(): string {
            return 'SecurityContext: none';
          }
        };
    }
}
