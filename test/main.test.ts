import { describe, expect, it, vi } from 'vitest';
import microhttp from '../src/index.ts';

describe('Basic GET Request', async () => {
    const res = await microhttp.get('https://www.google.com')
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
