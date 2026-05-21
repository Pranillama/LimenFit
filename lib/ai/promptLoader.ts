import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { assertServerOnly } from '@/lib/env';

assertServerOnly();

export const SYSTEM_PROMPT = readFileSync(join(process.cwd(), 'prompts/ask/system.v1.md'), 'utf8');

export const TOOLS_PROMPT = readFileSync(join(process.cwd(), 'prompts/ask/tools.v1.md'), 'utf8');
