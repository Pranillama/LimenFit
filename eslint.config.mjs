// Uses FlatCompat to bridge eslint-config-next (which ships CommonJS presets) into
// ESLint 9 flat config. @eslint/eslintrc is required only for this bridging; it can
// be removed once eslint-config-next exposes native flat-config entry points.
import { FlatCompat } from '@eslint/eslintrc';
import { defineConfig, globalIgnores } from 'eslint/config';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const compat = new FlatCompat({ baseDirectory: __dirname });

export default defineConfig([
  globalIgnores([
    '.next/**',
    'node_modules/**',
    'public/**',
    'supabase/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
  ]),
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  ...compat.extends('prettier'),
]);
