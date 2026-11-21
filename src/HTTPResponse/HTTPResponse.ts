/**
 * Brand that marks a value as a real HTTP response envelope.
 *
 * The adapter must never decide that a handler's return value is an envelope (status, headers, custom `send`) based on
 * a plain JSON-forgeable property: a handler that echoes request data would let a caller pick its own status code and
 * response headers (Location, Set-Cookie, ...). A symbol can't come from a JSON body, and `Symbol.for` keeps it working
 * if an app ends up with two copies of this package.
 *
 * It is an own, enumerable property (not on the prototype) so that copies such as `{ ...response }` and
 * `Object.assign({}, response)` stay real responses. `JSON.stringify` ignores symbol keys.
 */
// The key is a stable identifier shared by every copy of this library, not the npm package name: don't change it when renaming.
export const HTTP_RESPONSE_BRAND = Symbol.for('@symbiotic/express-router-adapter/HTTPResponse');

/**
 * True for `HTTPResponse`/`HTTPError` instances, and for hand built envelopes that carry a `send` function
 * (a function can't be produced by JSON either). Plain objects with only status/headers/body are NOT envelopes.
 */
export const isHTTPResponse = (value: any): boolean => {
    if (value === null || typeof value !== 'object') {
        return false;
    }
    return value[HTTP_RESPONSE_BRAND] === true || (value.isHTTPResponse === true && typeof value.send === 'function');
};

export interface IHTTPResponse {
    status: number;
    headers: { [key: string]: string };
    isHTTPResponse: boolean;
    body: any;
}

export class HTTPResponse implements IHTTPResponse {
    status: number;
    headers: { [key: string]: string };
    isHTTPResponse: boolean = true;
    body: any;

    constructor({ status, headers = {}, body }: {
        status: number,
        headers?: { [key: string]: string },
        body?: any
    }) {
        this.status = status;
        this.headers = headers;
        this.body = body;
        Object.defineProperty(this, HTTP_RESPONSE_BRAND, { value: true, enumerable: true });
    }
}
