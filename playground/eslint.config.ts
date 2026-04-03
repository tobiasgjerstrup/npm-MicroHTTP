import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import { defineConfig } from 'eslint/config';

export default defineConfig([
    { ignores: ['eslint.config.ts', 'dist/**', '**/*.js'] },
    {
        files: ['**/*.ts'],
        languageOptions: {
            globals: globals.node,
            parserOptions: {
                project: ['./tsconfig.eslint.json'],
                tsconfigRootDir: import.meta.dirname,
            },
        },
    },
    js.configs.recommended,
    tseslint.configs.strictTypeChecked,
    tseslint.configs.stylisticTypeChecked,
    {
        files: ['**/*.ts'],
        rules: {
            '@typescript-eslint/no-duplicate-type-constituents': 'error',
        },
    },
]);
