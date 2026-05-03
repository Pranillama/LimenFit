'use client';

import * as React from 'react';
import { Search, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SheetTitle } from '@/components/ui/sheet';

interface PickerHeaderProps {
  title?: string;
  selectedCount: number;
  query: string;
  onQueryChange: (query: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}

export function PickerHeader({
  title = 'Select Exercises',
  selectedCount,
  query,
  onQueryChange,
  onClose,
  onConfirm,
}: PickerHeaderProps) {
  const [localQuery, setLocalQuery] = React.useState(query);
  const [activeFilter, setActiveFilter] = React.useState<'equipment' | 'muscles' | null>(null);

  React.useEffect(() => {
    setLocalQuery(query);
  }, [query]);

  React.useEffect(() => {
    const t = setTimeout(() => onQueryChange(localQuery), 150);
    return () => clearTimeout(t);
  }, [localQuery, onQueryChange]);

  return (
    <div className="sticky top-0 z-10 flex flex-col gap-3 border-b bg-background px-4 pb-3 pt-4">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Close"
          onClick={onClose}
          className="-ml-2 shrink-0"
        >
          <X className="h-5 w-5" />
        </Button>
        <SheetTitle className="grow text-center">{title}</SheetTitle>
        <Button
          size="sm"
          disabled={selectedCount === 0}
          onClick={onConfirm}
          className="shrink-0"
        >
          {selectedCount > 0 ? `Add (${selectedCount})` : 'Add'}
        </Button>
      </div>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search exercises…"
          value={localQuery}
          onChange={(e) => setLocalQuery(e.target.value)}
          className="pl-9 pr-9"
        />
        {localQuery && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => setLocalQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 text-xs"
          aria-pressed={activeFilter === 'equipment'}
          onClick={() => setActiveFilter(activeFilter === 'equipment' ? null : 'equipment')}
        >
          All Equipment ▾
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 text-xs"
          aria-pressed={activeFilter === 'muscles'}
          onClick={() => setActiveFilter(activeFilter === 'muscles' ? null : 'muscles')}
        >
          All Muscles ▾
        </Button>
      </div>
    </div>
  );
}
