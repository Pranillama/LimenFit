'use client';

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Send } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { useAskStream } from '../lib/useAskStream';
import { SuggestedPrompts } from './SuggestedPrompts';
import { ToolCallIndicator } from './ToolCallIndicator';

interface ChatViewProps {
  suggestedPrompts: string[];
}

export function ChatView({ suggestedPrompts }: ChatViewProps) {
  const { messages, send, reset, status, error } = useAskStream();
  const [input, setInput] = useState('');
  const listEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages]);

  const isStreaming = status === 'streaming';
  const isEmpty = messages.length === 0;

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;
    setInput('');
    send(trimmed);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const form = e.currentTarget.form;
      if (form) form.requestSubmit();
    }
  };

  const handleSuggested = (prompt: string) => {
    if (isStreaming) return;
    send(prompt);
  };

  return (
    <div className="flex min-h-[calc(100dvh-10rem)] flex-col gap-4 md:min-h-[calc(100dvh-8rem)]">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Ask</h1>
        {!isEmpty && (
          <Button type="button" variant="ghost" size="sm" onClick={reset}>
            New conversation
          </Button>
        )}
      </header>

      <div className="flex-1 overflow-y-auto">
        {isEmpty ? (
          <div className="flex flex-col gap-6 py-4">
            <div>
              <p className="text-lg font-medium">How can I help with your training?</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Ask about your history, PRs, or what to do next.
              </p>
            </div>
            <SuggestedPrompts prompts={suggestedPrompts} onSelect={handleSuggested} />
          </div>
        ) : (
          <ul className="flex flex-col gap-4 py-2">
            {messages.map((m) => (
              <li
                key={m.id}
                className={cn('flex flex-col gap-2', m.role === 'user' ? 'items-end' : 'items-start')}
              >
                {m.role === 'assistant' && m.toolCalls && m.toolCalls.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {m.toolCalls.map((tc) => (
                      <ToolCallIndicator key={tc.id} summary={tc.argsSummary} />
                    ))}
                  </div>
                )}
                <div
                  className={cn(
                    'max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
                    m.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-foreground',
                  )}
                >
                  {m.content}
                  {m.role === 'assistant' && m.content.length === 0 && isStreaming && (
                    <StreamingDots />
                  )}
                </div>
              </li>
            ))}
            <div ref={listEndRef} />
          </ul>
        )}
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-md border border-destructive/60 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {error}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="sticky bottom-0 flex items-end gap-2 bg-background pb-2 pt-2"
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          placeholder="Ask about your training…"
          aria-label="Message"
          className="min-h-[44px] max-h-40 flex-1 resize-none rounded-md border bg-background px-3 py-2.5 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
        <Button
          type="submit"
          size="icon"
          aria-label="Send message"
          disabled={input.trim().length === 0 || isStreaming}
        >
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}

function StreamingDots() {
  return (
    <span
      aria-label="Coach is thinking"
      className="inline-flex items-center gap-1 align-middle"
    >
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/70 [animation-delay:-0.3s]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/70 [animation-delay:-0.15s]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/70" />
    </span>
  );
}
