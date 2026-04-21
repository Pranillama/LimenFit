/**
 * Environment variable validation. Throws at import if required vars are missing.
 * Server vars consumed in T2 (a5105531-25cd-492a-b63a-a9126484fe6c).
 * This module must remain free of runtime side effects beyond schema validation.
 */

import { z } from 'zod';

const serverSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
});

const clientSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
});

const clientValues = {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
};

const clientResult = clientSchema.safeParse(clientValues);

const isServer = typeof window === 'undefined';

const serverResult = isServer
  ? serverSchema.safeParse(process.env)
  : ({ success: true as const, data: undefined });

if (!clientResult.success || (isServer && !serverResult.success)) {
  const issues: string[] = [];

  if (!clientResult.success) {
    for (const issue of clientResult.error.issues) {
      issues.push(issue.path.join('.') + ': ' + issue.message);
    }
  }

  if (isServer && !serverResult.success) {
    for (const issue of (serverResult as z.SafeParseError<unknown>).error.issues) {
      issues.push(issue.path.join('.') + ': ' + issue.message);
    }
  }

  throw new Error('Invalid environment variables:\n  ' + issues.join('\n  '));
}

type ServerEnv = z.infer<typeof serverSchema>;

const serverEnv: ServerEnv = isServer
  ? (serverResult as z.SafeParseSuccess<ServerEnv>).data
  : (new Proxy({} as ServerEnv, {
      get() {
        throw new Error(
          'Server env accessed in browser; import via a server-only module',
        );
      },
    }) as ServerEnv);

export const env = Object.freeze({
  server: serverEnv,
  client: (clientResult as z.SafeParseSuccess<z.infer<typeof clientSchema>>).data,
});

export function assertServerOnly(): void {
  if (typeof window !== 'undefined') {
    throw new Error(
      'assertServerOnly: this module must not be imported in browser bundles',
    );
  }
}
