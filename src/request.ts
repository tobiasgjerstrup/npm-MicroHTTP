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

        const bodyData = options.body !== undefined ? typeof options.body !== 'string' ? JSON.stringify(options.body) : options.body : undefined;

        const reqOptions: http.RequestOptions = {
            hostname: parsed.hostname,
            port: parsed.port || (isHttps ? 443 : 80),
            path: parsed.pathname + parsed.search,
            method,
            headers: {
                Accept: 'application/json',
                ...options.headers,
                ...(bodyData !== undefined && {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(bodyData).toString(),
                }),
            },
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
