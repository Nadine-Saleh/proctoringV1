import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import importPlugin from 'eslint-plugin-import';
import tseslint from 'typescript-eslint';

// Layered import direction (research.md §R4):
//   - features  → may import from shared/, lib/
//   - shared    → may import from lib/ only
//   - lib       → no inward imports
//   - cross-feature imports MUST go through the feature's index.ts barrel
const layeredRestrictedPatterns = [
  // shared/** must not reach into features/**
  {
    group: ['@/features/*', '@/features/**'],
    message:
      'src/shared/** must not import from src/features/**. Shared primitives are feature-agnostic.',
  },
];
const libRestrictedPatterns = [
  {
    group: ['@/features/*', '@/features/**'],
    message: 'src/lib/** must not import from src/features/**.',
  },
  {
    group: ['@/shared/*', '@/shared/**'],
    message: 'src/lib/** must not import from src/shared/**.',
  },
];
// Cross-feature: a feature may import another feature's barrel, but never its internals.
const crossFeatureRestrictedPatterns = [
  {
    group: ['@/features/*/!(index)', '@/features/*/**'],
    message:
      'Cross-feature imports must go through the target feature index.ts barrel (e.g. "@/features/scoring"), not its internals.',
  },
];
// Components must not import infrastructure SDKs directly — those belong in services/engine.
const componentInfraRestrictedPatterns = [
  {
    group: ['@supabase/supabase-js', '@supabase/*'],
    message:
      'Components must not import @supabase/supabase-js directly. Move data access into a service.',
  },
  {
    group: ['face-api.js', 'face-api.js/*'],
    message:
      'Components must not import face-api.js directly. Move detection calls into a service or engine.',
  },
  {
    group: ['@mediapipe/*'],
    message:
      'Components must not import @mediapipe/* directly. Move model calls into a service or engine.',
  },
];

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'supabase/functions/**'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      import: importPlugin,
    },
    settings: {
      'import/resolver': {
        typescript: {
          project: ['./tsconfig.app.json'],
        },
        node: true,
      },
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      // Pre-existing project conventions (preserved):
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],

      // T003 — import hygiene
      'import/no-cycle': ['error', { maxDepth: 10, ignoreExternal: true }],
      'import/order': [
        'warn',
        {
          groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
          'newlines-between': 'always',
          alphabetize: { order: 'asc', caseInsensitive: true },
          pathGroups: [{ pattern: '@/**', group: 'internal', position: 'after' }],
          pathGroupsExcludedImportTypes: ['builtin'],
        },
      ],

      // T006 — size + complexity budget (warn during migration; flipped to error in T050/T063)
      'max-lines': [
        'warn',
        { max: 400, skipBlankLines: true, skipComments: true },
      ],
      complexity: ['warn', 10],
    },
  },

  // T004 — Cross-feature import restriction (applies to anything inside a feature)
  {
    files: ['src/features/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: [...crossFeatureRestrictedPatterns] },
      ],
    },
  },

  // T004 — shared/ may not import from features/
  {
    files: ['src/shared/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: [...layeredRestrictedPatterns] },
      ],
    },
  },

  // T004 — lib/ may not import from features/ or shared/
  {
    files: ['src/lib/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: [...libRestrictedPatterns] },
      ],
    },
  },

  // T005 — feature components must not import infrastructure SDKs directly
  {
    files: ['src/features/*/components/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            ...crossFeatureRestrictedPatterns,
            ...componentInfraRestrictedPatterns,
          ],
        },
      ],
    },
  },
);
