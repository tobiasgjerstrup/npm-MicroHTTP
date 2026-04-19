import http from 'node:http';
import https from 'node:https';

/**
 * Error thrown when a request completes with a non-2xx HTTP status code.
 */
export class HTTPError extends Error {
    /**
     * @param status HTTP status code returned by the server.
     * @param body Parsed response body returned by the server.
     * @param headers Response headers returned by the server.
     */
    constructor(
        public readonly status: number,
        public readonly body: unknown,
        public readonly headers: Record<string, string | string[]>,
    ) {
        super(`HTTP ${status.toString()}`);
        this.name = 'HTTPError';
    }
}

/**
 * Error thrown when the URL hostname cannot be resolved.
 */
export class UrlNotFoundError extends Error {
    /**
     * @param url URL that could not be resolved.
     * @param cause Original low-level error.
     */
    constructor(
        public readonly url: string,
        public readonly cause?: unknown,
    ) {
        super(`URL not found: ${url}`);
        this.name = 'UrlNotFoundError';
    }
}

/**
 * Options shared by all request methods.
 */
export interface RequestOptions {
    /**
     * Additional request headers.
     */
    headers?: Record<string, string>;

    /**
     * Request payload. Non-string values are JSON-stringified when contentType is application/json.
     */
    body?: unknown;

    /**
     * Whether to ignore local issuer certificate errors when making HTTPS requests. This is useful for testing against servers with self-signed certificates. Use with caution in production environments.
     */
    ignoreLocalIssuerCertificate?: boolean;

    /**
     * Basic authentication credentials, used to set the Authorization header if not already provided in the headers option.
     */
    basicAuth?: {
        username: string;
        password: string;
    };

    /**
     * The content type of the request body, used to set the Content-Type header. Defaults to 'application/json' if body is an object and not a string.
     */
    contentType?: string;

    /**
     * The expected response content type, used to set the Accept header. Defaults to 'application/json'.
     * https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Accept
     */
    acceptType?: string;
}

/**
 * Normalized response returned by MicroHTTP.
 *
 * @typeParam T Type of the parsed response body.
 */
export interface Response<T = unknown> {
    /**
     * HTTP status code.
     */
    status: number;

    /**
     * Response headers.
     */
    headers: Record<string, string | string[]>;

    /**
     * Parsed response body.
     */
    body: T;
}

type WritableBody = string | Buffer;

function request<T>(method: string, url: string, options: RequestOptions = {}): Promise<Response<T>> {
    return new Promise((resolve, reject) => {
        options.acceptType = options.acceptType ?? 'application/json';
        options.contentType = options.contentType ?? 'application/json';
        const parsed = new URL(url);
        const isHttps = parsed.protocol === 'https:';
        const transport = isHttps ? https : http;
        const hasAuthorizationHeader = Object.keys(options.headers ?? {}).some(
            (header) => header.toLowerCase() === 'authorization',
        );
        const basicAuthHeader =
            options.basicAuth && !hasAuthorizationHeader
                ? `Basic ${Buffer.from(`${options.basicAuth.username}:${options.basicAuth.password}`).toString('base64')}`
                : undefined;

        let bodyData: WritableBody | undefined;
        if (options.contentType === 'application/json') {
            bodyData = options.body !== undefined
                ? typeof options.body !== 'string'
                    ? JSON.stringify(options.body)
                    : options.body
                : undefined;
        } else {
            if (typeof options.body === 'string') {
                bodyData = options.body;
            } else if (options.body instanceof URLSearchParams) {
                bodyData = options.body.toString();
            } else if (options.body instanceof ArrayBuffer) {
                bodyData = Buffer.from(options.body);
            } else if (ArrayBuffer.isView(options.body)) {
                bodyData = Buffer.from(options.body.buffer, options.body.byteOffset, options.body.byteLength);
            }
        }
        const reqOptions: http.RequestOptions = {
            hostname: parsed.hostname,
            port: parsed.port || (isHttps ? 443 : 80),
            path: parsed.pathname + parsed.search,
            method,
            headers: {
                Accept: options.acceptType,
                ...(basicAuthHeader !== undefined && { Authorization: basicAuthHeader }),
                ...options.headers,
                ...(bodyData !== undefined && {
                    'Content-Type': options.contentType ?? 'application/json',
                    'Content-Length': Buffer.byteLength(bodyData).toString(),
                }),
            },
            ...(isHttps && options.ignoreLocalIssuerCertificate ? { rejectUnauthorized: false } : {}),
        };

        const req = transport.request(reqOptions, (res) => {
            const chunks: Buffer[] = [];
            res.on('data', (chunk: Buffer) => chunks.push(chunk));
            res.on('end', () => {
                const raw = Buffer.concat(chunks).toString('utf8');
                const contentType = res.headers['content-type'] ?? '';
                let body: T;
                try {
                    body = contentType.includes('application/json') ? (JSON.parse(raw) as T) : (raw as T);
                } catch {
                    body = raw as T;
                }
                const status = res.statusCode ?? 0;
                const resHeaders = res.headers as Record<string, string | string[]>;
                if (status < 200 || status >= 300) {
                    reject(new HTTPError(status, body, resHeaders));
                } else {
                    resolve({ status, headers: resHeaders, body });
                }
            });
        });

        req.on('error', (error: NodeJS.ErrnoException) => {
            if (error.code === 'ENOTFOUND') {
                reject(new UrlNotFoundError(url, error));
                return;
            }

            reject(error);
        });

        if (bodyData !== undefined) {
            req.write(bodyData);
        }
        req.end();
    });
}

const microHTTP = {
    /**
     * Send an HTTP GET request.
     *
     * @typeParam T Expected response body type.
     * @param url Absolute request URL.
     * @param options Optional request options (without body for GET).
     * @returns The parsed response.
     * @throws {HTTPError} The server responds with a non-2xx status code.
     * @throws {UrlNotFoundError} The URL hostname cannot be resolved.
     * @throws {Error} Any other low-level transport, TLS, or request error.
     */
    get: <T = unknown>(url: string, options?: Omit<RequestOptions, 'body'>) => request<T>('GET', url, options),

    /**
     * Send an HTTP POST request.
     *
     * @typeParam T Expected response body type.
     * @param url Absolute request URL.
     * @param options Optional request options.
     * @returns The parsed response.
     * @throws {HTTPError} The server responds with a non-2xx status code.
     * @throws {UrlNotFoundError} The URL hostname cannot be resolved.
     * @throws {Error} Any other low-level transport, TLS, or request error.
     */
    post: <T = unknown>(url: string, options?: RequestOptions) => request<T>('POST', url, options),

    /**
     * Send an HTTP PUT request.
     *
     * @typeParam T Expected response body type.
     * @param url Absolute request URL.
     * @param options Optional request options.
     * @returns The parsed response.
     * @throws {HTTPError} The server responds with a non-2xx status code.
     * @throws {UrlNotFoundError} The URL hostname cannot be resolved.
     * @throws {Error} Any other low-level transport, TLS, or request error.
     */
    put: <T = unknown>(url: string, options?: RequestOptions) => request<T>('PUT', url, options),

    /**
     * Send an HTTP DELETE request.
     *
     * @typeParam T Expected response body type.
     * @param url Absolute request URL.
     * @param options Optional request options.
     * @returns The parsed response.
     * @throws {HTTPError} The server responds with a non-2xx status code.
     * @throws {UrlNotFoundError} The URL hostname cannot be resolved.
     * @throws {Error} Any other low-level transport, TLS, or request error.
     */
    del: <T = unknown>(url: string, options?: RequestOptions) => request<T>('DELETE', url, options),
};

export default microHTTP;
