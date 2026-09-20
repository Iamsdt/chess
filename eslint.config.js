import js from '@eslint/js'
import prettierConfig from 'eslint-config-prettier'
import importPlugin from 'eslint-plugin-import'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    ignores: [
      'dist',
      'coverage',
      'node_modules',
      'src-old',
      'prototype',
      'public',
      'playwright-report',
      'test-results',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,

  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: { import: importPlugin },
    settings: {
      'import/resolver': {
        typescript: {
          alwaysTryTypes: true,
          // The app/node split is intentional, so don't warn about two projects.
          noWarnOnMultipleProjects: true,
          project: ['./tsconfig.app.json', './tsconfig.node.json'],
        },
      },
    },
    rules: {
      // §5 quality bar: no `any`, errors are values, no dead code.
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'import/order': [
        'error',
        {
          groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index', 'type'],
          pathGroups: [{ pattern: '@/**', group: 'internal', position: 'before' }],
          'newlines-between': 'always',
          alphabetize: { order: 'asc', caseInsensitive: true },
        },
      ],
      'import/no-duplicates': 'error',
    },
  },

  // Layer boundaries (§2 file ownership). Pure layers must not reach up into
  // React, features must not reach past the repositories into Dexie.
  {
    files: ['src/domain/**/*.ts', 'src/chess/**/*.ts', 'src/engine/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'react',
              message: 'Pure layers stay free of React. Keep logic testable in isolation.',
            },
            { name: 'react-dom', message: 'Pure layers stay free of React.' },
            { name: 'zustand', message: 'Pure layers hold no UI state.' },
            { name: 'dexie', message: 'Pure layers do not touch storage. Take data as arguments.' },
          ],
          patterns: [
            {
              group: [
                '@/app',
                '@/app/*',
                '@/design',
                '@/design/*',
                '@/board',
                '@/board/*',
                '@/features',
                '@/features/*',
              ],
              message: 'Pure layers must not depend on UI layers.',
            },
            {
              group: ['@/data', '@/data/*'],
              message: 'Pure layers must not depend on persistence.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/features/**/*.{ts,tsx}', 'src/app/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'dexie',
              message: 'Features never touch Dexie directly. Use a repository from @/data.',
            },
          ],
          patterns: [
            {
              group: ['@/data/db*', '@/data/**/db*'],
              message: 'Features never touch the Dexie instance. Use a repository from @/data.',
            },
          ],
        },
      ],
    },
  },

  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh, 'jsx-a11y': jsxA11y },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-hooks/exhaustive-deps': 'error',
      ...jsxA11y.flatConfigs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },

  // Build scripts report to the terminal; that is their whole job.
  {
    files: ['scripts/**/*.{js,mjs}'],
    rules: { 'no-console': 'off' },
  },

  {
    files: ['**/*.{test,spec}.{ts,tsx}', 'src/test/**/*.ts', 'e2e/**/*.ts'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
    },
  },

  {
    files: ['*.config.{ts,js}', 'e2e/**/*.ts'],
    languageOptions: { globals: globals.node },
  },

  // Config files are plain JS and live outside the TS projects.
  {
    files: ['**/*.js', '**/*.mjs', '**/*.cjs'],
    ...tseslint.configs.disableTypeChecked,
    languageOptions: {
      ...tseslint.configs.disableTypeChecked.languageOptions,
      globals: globals.node,
    },
  },

  prettierConfig,
)
