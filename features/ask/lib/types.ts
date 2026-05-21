export type ChatRole = 'user' | 'assistant';

export interface ToolCallEvent {
  id: string;
  name: string;
  argsSummary: string;
}

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  toolCalls?: ToolCallEvent[];
}

export type StreamEvent =
  | { kind: 'text'; delta: string }
  | { kind: 'tool_call'; name: string; args: unknown }
  | { kind: 'done'; tokensIn: number; tokensOut: number }
  | { kind: 'error'; code: string; message: string };

export interface UseAskStreamResult {
  messages: ChatMessage[];
  send(text: string): void;
  reset(): void;
  status: 'idle' | 'streaming' | 'error';
  error: string | null;
}
