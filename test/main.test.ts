import { describe, expect, it, vi } from 'vitest';

describe('main', () => {
    it('logs the hello message', () => {
        const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

        console.log('Hello, TypeScript!');

        expect(logSpy).toHaveBeenCalledWith('Hello, TypeScript!');
        logSpy.mockRestore();
    });
});
