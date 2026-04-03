import * as http from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import microhttp, { HTTPError, UrlNotFoundError } from '../src/index.ts';

/** @type {import('node:http').Server} */
let server;

/** @type {string} */
let baseUrl;

beforeAll(async () => {
    await new Promise((resolve) => {
        /** @param {import('node:http').IncomingMessage} req
         *  @param {import('node:http').ServerResponse} res
         */
        server = http.createServer((req, res) => {
            res.setHeader('Content-Type', 'application/json');

            if (req.url === '/ok') {
                res.statusCode = 200;
                res.end(JSON.stringify({ message: 'ok' }));
            } else if (req.url === '/return-body-and-headers' && req.method === 'POST') {
                let body = '';
                /** @param {Buffer} chunk */
                req.on('data', (chunk) => {
                    body += chunk;
                });
                req.on('end', () => {
                    res.statusCode = 200;
                    res.end(JSON.stringify({ message: 'received', body, headers: req.headers }));
                });
            } else {
                res.statusCode = 404;
                res.end(JSON.stringify({ message: 'not found' }));
            }
        });
        server.listen(0, '127.0.0.1', () => {
            const addr = /** @type {import('node:net').AddressInfo} */ (server.address());
            baseUrl = `http://127.0.0.1:${addr.port}`;
            resolve();
        });
    });
});

afterAll(async () => {
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
        expect(res.body.body).toBe(JSON.stringify({ name: 'John Doe', age: 30 }));
        expect(res.status).toBe(200);
    });
});
