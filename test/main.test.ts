import { describe, expect, it, vi } from 'vitest';
import microhttp, { HTTPError, UrlNotFoundError } from '../src/index.ts';

describe('Basic GET Request', async () => {
    const res = await microhttp.get('https://www.google.com');
    it('Request gives 200 OK', () => {
        expect(res.status).toBe(200);
    });
    it('Request gives a body', () => {
        expect(res.body).toBeTruthy();
    });
    it('Request gives headers', () => {
        expect(res.headers).toBeTruthy();
    });
    it('Request gives headers with content-type', () => {
        expect(res.headers['content-type'] || res.headers['Content-Type']).toBeTruthy();
    });
});

describe('GET Request to non-existing page', async () => {
    let res = null;
    try {
        await microhttp.get('https://www.google.com/non-existing-page');
    } catch (error: unknown) {
        if (!(error instanceof HTTPError)) {
            throw error;
        }
        res = error;
    }
    if (!res) {
        throw new Error('Error is null or undefined');
    }

    it('Request gives 404 Not Found', async () => {
        expect(res.status).toBe(404);
    });
});

describe('GET Request to non-existing domain', async () => {
    let res = null;
    try {
        await microhttp.get('https://www.google.com.non-existing-domain');
    } catch (error: unknown) {
        if (!(error instanceof UrlNotFoundError)) {
            throw error;
        }
        res = error;
    }
    if (!res) {
        throw new Error('Error is null or undefined');
    }

    it ('Request gives UrlNotFoundError', async () => {
        expect(res).toBeInstanceOf(UrlNotFoundError);
    });
});
