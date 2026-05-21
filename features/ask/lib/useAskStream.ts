'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { summarizeToolCall } from '../components/ToolCallIndicator';
import type { ChatMessage, ToolCallEvent, UseAskStreamResult } from './types';

function makeId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function useAskStream(): UseAskStreamResult {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<'idle' | 'streaming' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const messagesRef = useRef<ChatMessage[]>([]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setMessages([]);
    setStatus('idle');
    setError(null);
  }, []);

  const appendDelta = useCallback((assistantMsgId: string, delta: string) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === assistantMsgId ? { ...m, content: m.content + delta } : m)),
    );
  }, []);

  const appendToolCall = useCallback((assistantMsgId: string, tc: ToolCallEvent) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === assistantMsgId ? { ...m, toolCalls: [...(m.toolCalls ?? []), tc] } : m,
      ),
    );
  }, []);

  const send = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      if (status === 'streaming') return;

      setError(null);

      const userMsg: ChatMessage = { id: makeId(), role: 'user', content: trimmed };
      const assistantId = makeId();
      const assistantMsg: ChatMessage = {
        id: assistantId,
        role: 'assistant',
        content: '',
        toolCalls: [],
      };

      const historyForServer = [...messagesRef.current, userMsg]
        .filter((m) => m.role !== 'assistant' || m.content.length > 0)
        .map((m) => ({
          role: m.role,
          content: m.content,
        }));

      setMessages((prev) => [...prev, userMsg, assistantMsg]);

      const controller = new AbortController();
      abortRef.current?.abort();
      abortRef.current = controller;
      setStatus('streaming');

      const processFrame = (frame: string) => {
        const lines = frame.split('\n');
        let eventName = 'message';
        const dataLines: string[] = [];
        for (const line of lines) {
          if (line.startsWith('event:')) {
            eventName = line.slice(6).trim();
          } else if (line.startsWith('data:')) {
            dataLines.push(line.slice(5).trimStart());
          }
        }
        if (dataLines.length === 0) return;
        const dataStr = dataLines.join('\n');
        let data: unknown;
        try {
          data = JSON.parse(dataStr);
        } catch {
          return;
        }

        if (eventName === 'tool_call') {
          const payload = data as { name: string; args: unknown };
          appendToolCall(assistantId, {
            id: makeId(),
            name: payload.name,
            argsSummary: summarizeToolCall(payload.name, payload.args),
          });
        } else if (eventName === 'error') {
          const payload = data as { code?: string; message?: string };
          setStatus('error');
          setError(payload.message ?? 'Something went wrong.');
        } else if (eventName === 'done') {
          // tokens accounted server-side
        } else {
          const payload = data as { delta?: string };
          if (typeof payload.delta === 'string' && payload.delta.length > 0) {
            appendDelta(assistantId, payload.delta);
          }
        }
      };

      const run = async () => {
        try {
          const res = await fetch('/api/ask', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messages: historyForServer }),
            signal: controller.signal,
          });

          if (res.status === 404) {
            setStatus('error');
            setError('Coach is offline right now — try again in a moment.');
            return;
          }
          if (res.status === 429) {
            let message = "You're chatting fast — try again in a few minutes.";
            try {
              const json = (await res.json()) as {
                error?: { message?: string };
                message?: string;
              };
              if (typeof json?.error?.message === 'string') {
                message = json.error.message;
              } else if (typeof json?.message === 'string') {
                message = json.message;
              }
            } catch {
              // ignore parse failures, use default
            }
            setStatus('error');
            setError(message);
            return;
          }
          if (!res.ok || !res.body) {
            setStatus('error');
            setError('Coach is offline right now — try again in a moment.');
            return;
          }

          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';

          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });

            let sepIdx: number;
            while ((sepIdx = buffer.indexOf('\n\n')) !== -1) {
              const frame = buffer.slice(0, sepIdx);
              buffer = buffer.slice(sepIdx + 2);
              if (frame.trim().length > 0) processFrame(frame);
            }
          }

          if (buffer.trim().length > 0) {
            processFrame(buffer);
          }

          setStatus((s) => (s === 'error' ? s : 'idle'));
        } catch (err) {
          if ((err as Error)?.name === 'AbortError') {
            return;
          }
          setStatus('error');
          setError('Coach is offline right now — try again in a moment.');
        }
      };

      void run();
    },
    [appendDelta, appendToolCall, status],
  );

  return { messages, send, reset, status, error };
}
