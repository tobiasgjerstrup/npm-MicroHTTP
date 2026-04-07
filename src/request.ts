import http from 'node:http';
import https from 'node:https';

export class HTTPError extends Error {
    constructor(
        public readonly status: number,
        public readonly body: unknown,
        public readonly headers: Record<string, string | string[]>,
    ) {
        super(`HTTP ${status.toString()}`);
        this.name = 'HTTPError';
    }
}

export class UrlNotFoundError extends Error {
    constructor(public readonly url: string, public readonly cause?: unknown) {
        super(`URL not found: ${url}`);
        this.name = 'UrlNotFoundError';
    }
}

export interface RequestOptions {
    headers?: Record<string, string>;
    body?: unknown;
    ignoreLocalIssuerCertificate?: boolean;
    basicAuth?: {
        username: string;
        password: string;
    };
}

export interface Response<T = unknown> {
    status: number;
    headers: Record<string, string | string[]>;
    body: T;
}

function request<T>(method: string, url: string, options: RequestOptions = {}): Promise<Response<T>> {
    return new Promise((resolve, reject) => {
        const parsed = new URL(url);
        const isHttps = parsed.protocol === 'https:';
        const transport = isHttps ? https : http;
        const hasAuthorizationHeader = Object.keys(options.headers ?? {}).some((header) => header.toLowerCase() === 'authorization');
        const basicAuthHeader = options.basicAuth && !hasAuthorizationHeader
            ? `Basic ${Buffer.from(`${options.basicAuth.username}:${options.basicAuth.password}`).toString('base64')}`
            : undefined;

        const bodyData = options.body !== undefined ? typeof options.body !== 'string' ? JSON.stringify(options.body) : options.body : undefined;

        const reqOptions: http.RequestOptions = {
            hostname: parsed.hostname,
            port: parsed.port || (isHttps ? 443 : 80),
            path: parsed.pathname + parsed.search,
            method,
            headers: {
                Accept: 'application/json',
                ...(basicAuthHeader !== undefined && { Authorization: basicAuthHeader }),
                ...options.headers,
                ...(bodyData !== undefined && {
                    'Content-Type': 'application/json',
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
    get: <T = unknown>(url: string, options?: Omit<RequestOptions, 'body'>) => request<T>('GET', url, options),

    post: <T = unknown>(url: string, options?: RequestOptions) => request<T>('POST', url, options),

    put: <T = unknown>(url: string, options?: RequestOptions) => request<T>('PUT', url, options),

    del: <T = unknown>(url: string, options?: RequestOptions) => request<T>('DELETE', url, options),
};

export default microHTTP;
