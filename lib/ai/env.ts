import { assertServerOnly, env } from '@/lib/env';

assertServerOnly();

export const GEMINI_MODEL = 'gemini-2.5-flash';

export function isAiAssistantEnabled(): boolean {
  return env.server.LIMENFIT_FEATURE_AI_ASSISTANT;
}

export function requireGeminiApiKey(): string {
  const key = env.server.GOOGLE_GENAI_API_KEY;
  if (!env.server.LIMENFIT_FEATURE_AI_ASSISTANT) {
    return key ?? '';
  }
  if (!key) {
    throw new Error(
      'GOOGLE_GENAI_API_KEY is required when LIMENFIT_FEATURE_AI_ASSISTANT is enabled',
    );
  }
  return key;
}

export function shouldLogPromptText(): boolean {
  return env.server.LIMENFIT_AI_LOG_PROMPT_TEXT;
}
