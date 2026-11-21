import { ISecurityContext } from './ISecurityContext';

export interface ISecurityContextProvider {
    getSecurityContext(params: { req: any; [key: string]: any }): Promise<ISecurityContext>;
}
