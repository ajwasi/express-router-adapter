import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/**', 'docs/**', 'coverage/**', 'node_modules/**', 'sample-app/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // The adapter deliberately works with loosely typed express requests and route params.
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-unused-expressions': 'error',
      'no-console': 'off'
    }
  },
  {
    files: ['tests/**/*.ts'],
    rules: {
      '@typescript-eslint/no-unused-vars': 'off'
    }
  }
);
