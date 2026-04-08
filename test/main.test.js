import nodeHttp from 'node:http';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import createApp from '@tobiasgjerstrup/microhttp-server';
import microhttp, { HTTPError, UrlNotFoundError } from '../src/index.ts';

/** @type {import('node:http').Server} */
let server;

/** @type {string} */
let baseUrl;

beforeAll(async () => {
    const app = createApp();
    const originalCreateServer = nodeHttp.createServer.bind(nodeHttp);

    app.get('/ok', (_req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.statusCode = 200;
        res.end(JSON.stringify({ message: 'ok' }));
    });

    app.get('/echo-headers', (req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.statusCode = 200;
        res.end(JSON.stringify({ headers: req.headers }));
    });

    app.post('/return-body-and-headers', (req, res) => {
        res.statusCode = 200;
        req.headers['accept'] = req.headers['accept'] ?? 'application/json';

        res.setHeader('content-type', req.headers['accept']);
        if (req.body instanceof URLSearchParams) {
            req.body = req.body.toString();
        }
        res.end(JSON.stringify({ message: 'received', body: req.body, headers: req.headers }));
    });

    const createServerSpy = vi.spyOn(nodeHttp, 'createServer').mockImplementation((...args) => {
        server = originalCreateServer(...args);
        return server;
    });

    await new Promise((resolve, reject) => {
        app.listen(0, '127.0.0.1', () => {
            createServerSpy.mockRestore();

            if (!server) {
                reject(new Error('Failed to capture internal server instance'));
                return;
            }

            const addr = /** @type {import('node:net').AddressInfo} */ (server.address());
            baseUrl = `http://127.0.0.1:${addr.port}`;
            resolve();
        });
    });
});

afterAll(async () => {
    if (!server) {
        return;
    }

    await new Promise((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
    });
});

describe('Basic GET Request', () => {
    it('Request gives 200 OK', async () => {
        const res = await microhttp.get(`${baseUrl}/ok`);
        expect(res.status).toBe(200);
    });

    it('Request gives a body', async () => {
        const res = await microhttp.get(`${baseUrl}/ok`);
        expect(res.body).toBeTruthy();
    });

    it('Request gives headers', async () => {
        const res = await microhttp.get(`${baseUrl}/ok`);
        expect(res.headers).toBeTruthy();
    });

    it('Request gives headers with content-type', async () => {
        const res = await microhttp.get(`${baseUrl}/ok`);
        expect(res.headers['content-type'] || res.headers['Content-Type']).toBeTruthy();
    });
});

describe('GET Request to non-existing page', () => {
    it('Request gives 404 Not Found', async () => {
        /** @type {HTTPError | null} */
        let res = null;
        try {
            await microhttp.get(`${baseUrl}/not-found`);
        } catch (error) {
            if (!(error instanceof HTTPError)) {
                throw error;
            }
            res = error;
        }

        expect(res).toBeTruthy();
        expect(res?.status).toBe(404);
    });
});

describe('GET Request to non-existing domain', () => {
    it('Request gives UrlNotFoundError', async () => {
        /** @type {UrlNotFoundError | null} */
        let res = null;
        try {
            await microhttp.get('http://does-not-exist.invalid');
        } catch (error) {
            if (!(error instanceof UrlNotFoundError)) {
                throw error;
            }
            res = error;
        }

        expect(res).toBeInstanceOf(UrlNotFoundError);
    });
});

describe('POST Request with body', () => {
    it('Request gives 404 Not Found', async () => {
        /** @type {HTTPError | null} */
        let res = null;
        try {
            await microhttp.get(`${baseUrl}/not-found`);
        } catch (error) {
            if (!(error instanceof HTTPError)) {
                throw error;
            }
            res = error;
        }

        expect(res).toBeTruthy();
        expect(res?.status).toBe(404);
    });

    it('sends body correctly', async () => {
        const res = await microhttp.post(`${baseUrl}/return-body-and-headers`, {
            body: { name: 'John Doe', age: 30 },
            headers: { 'Custom-Header': 'CustomValue' },
        });

        expect(res.body.headers['custom-header']).toBe('CustomValue');
        expect(res.body.body).toEqual({ name: 'John Doe', age: 30 });
        expect(res.status).toBe(200);
    });
});

describe('Basic Auth', () => {
    it('sends basic auth header', async () => {
        const res = await microhttp.get(`${baseUrl}/echo-headers`, {
            basicAuth: {
                username: 'john',
                password: 'secret',
            },
        });

        expect(res.status).toBe(200);
        expect(res.body.headers.authorization).toBe('Basic am9objpzZWNyZXQ=');
    });

    it('prefers explicit authorization header over basicAuth option', async () => {
        const res = await microhttp.get(`${baseUrl}/echo-headers`, {
            basicAuth: {
                username: 'john',
                password: 'secret',
            },
            headers: {
                Authorization: 'Bearer token-123',
            },
        });

        expect(res.status).toBe(200);
        expect(res.body.headers.authorization).toBe('Bearer token-123');
    });
});

describe('Content-Type and Accept headers', () => {
    it('sets Content-Type header based on contentType option', async () => {
        const res = await microhttp.post(`${baseUrl}/return-body-and-headers`, {
            body: 'Hello, world!"},',
            contentType: 'text/plain',
            acceptType: 'application/www-form-urlencoded',
        });
        const parsedBody = typeof res.body === 'string' ? JSON.parse(res.body) : res.body;

        expect(parsedBody.headers['content-type']).toBe('text/plain');
        expect(parsedBody.headers['accept']).toBe('application/www-form-urlencoded');
        expect(res.headers['content-type']).toBe('application/www-form-urlencoded');
        expect(parsedBody.body).toBe('Hello, world!"},');
    });
});

describe('x-www-form-urlencoded content type', () => {
    it('sends form data correctly', async () => {
        const res = await microhttp.post(`${baseUrl}/return-body-and-headers`, {
            body: new URLSearchParams({ name: 'John Doe', age: '30' }),
            contentType: 'application/x-www-form-urlencoded',
            acceptType: 'text/plain'
        });
        const parsedBody = typeof res.body === 'string' ? JSON.parse(res.body) : res.body;
        expect(parsedBody.body).toBe('name=John+Doe&age=30');
    });
});
