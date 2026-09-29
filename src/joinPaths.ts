/**
 * Joins URL path segments into a single express route path:
 * always a leading slash, duplicate slashes collapsed, and no trailing slash (except for the root path).
 *
 * This replaces the `proper-url-join` dependency, which pulled in `query-string` and a vulnerable
 * `decode-uri-component` just to do this.
 */
export const joinPaths = (...parts: string[]): string => {
    const collapsed = `/${parts.filter(Boolean).join('/')}`.replace(/\/{2,}/g, '/');
    return collapsed.length > 1 ? collapsed.replace(/\/+$/, '') : collapsed;
};
