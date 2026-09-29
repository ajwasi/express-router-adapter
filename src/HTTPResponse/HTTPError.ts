import { HTTP_RESPONSE_BRAND, IHTTPResponse } from './HTTPResponse';

export class HTTPError extends Error implements IHTTPResponse {
    status: number;
    code?: string;
    headers: { [key: string]: string } = {};
    isHTTPResponse: boolean = true;
    body: any;

    constructor({ message, status, code, headers, body }: {
        message: string,
        status: number,
        code?: string;
        headers?: { [key: string]: string },
        body?: any
    }) {
        super(message);
        this.status = status;
        this.code = code;
        this.headers = headers;
        this.body = body;
    }

}

Object.defineProperty(HTTPError.prototype, HTTP_RESPONSE_BRAND, { value: true });
