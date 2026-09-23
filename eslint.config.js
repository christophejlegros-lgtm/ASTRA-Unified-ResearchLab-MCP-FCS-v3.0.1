// ASTRA — ESLint 9 flat config (TypeScript)
// © 2026 Christophe Jean Legros — Geneva
//
// Répare `npm run lint` : ESLint ≥ 9 exige eslint.config.js (le format
// .eslintrc est abandonné). Règles alignées sur le tsconfig strict.

import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/', 'node_modules/', 'dashboard/', 'python/', 'tests/'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.ts'],
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      'no-console': 'off', // logger pino utilisé; console réservée au stdio banner
    },
  },
);
