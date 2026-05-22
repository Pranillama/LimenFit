'use client';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface SuggestedPromptsProps {
  prompts: string[];
  onSelect: (prompt: string) => void;
  className?: string;
}

export function SuggestedPrompts({ prompts, onSelect, className }: SuggestedPromptsProps) {
  return (
    <div role="list" className={cn('grid grid-cols-1 gap-2 sm:grid-cols-2', className)}>
      {prompts.map((prompt) => (
        <div key={prompt} role="listitem" className="contents">
          <Button
            type="button"
            variant="outline"
            aria-label={`Use suggested prompt: ${prompt}`}
            onClick={() => onSelect(prompt)}
            className="h-auto justify-start whitespace-normal px-4 py-3 text-left text-sm font-normal leading-snug"
          >
            {prompt}
          </Button>
        </div>
      ))}
    </div>
  );
}
