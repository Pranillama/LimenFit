import { z } from 'zod';

export const askMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1).max(8000),
});

export const askBodySchema = z
  .object({
    messages: z.array(askMessageSchema).min(1).max(50),
  })
  .refine((v) => v.messages[v.messages.length - 1]?.role === 'user', {
    message: 'The last message must be from the user',
    path: ['messages'],
  });

export type AskBody = z.infer<typeof askBodySchema>;
