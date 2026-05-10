'use client';

import * as React from 'react';
import { Share2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/sonner';
import { useSharePlanMutation } from '../hooks/useSharePlanMutation';

interface Props {
  planId: string;
  initialShareSlug: string;
  initialIsPublic: boolean;
}

async function copyToClipboard(text: string): Promise<void> {
  if (navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // fall through to textarea fallback
    }
  }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  try {
    const ok = document.execCommand('copy');
    if (!ok) throw new Error('execCommand copy failed');
  } finally {
    document.body.removeChild(ta);
  }
}

export function SharePlanButton({ planId, initialShareSlug, initialIsPublic }: Props) {
  const [currentShareSlug, setCurrentShareSlug] = React.useState(initialShareSlug);
  const [currentIsPublic, setCurrentIsPublic] = React.useState(initialIsPublic);
  const [label, setLabel] = React.useState<'Share' | 'Sharing…' | 'Copied!'>('Share');
  const sharePlan = useSharePlanMutation();

  function flashCopied() {
    setLabel('Copied!');
    setTimeout(() => setLabel('Share'), 1500);
  }

  async function handleClick() {
    const url = `${window.location.origin}/plan/${currentShareSlug}`;

    if (currentIsPublic) {
      try {
        await copyToClipboard(url);
        toast.success('Link copied!');
        flashCopied();
      } catch {
        toast.error('Could not copy link — please copy it manually');
      }
      return;
    }

    setLabel('Sharing…');
    sharePlan.mutate(
      { id: planId },
      {
        onSuccess: async (data) => {
          setCurrentShareSlug(data.shareSlug);
          setCurrentIsPublic(data.isPublic);
          const newUrl = `${window.location.origin}/plan/${data.shareSlug}`;
          try {
            await copyToClipboard(newUrl);
            toast.success('Link copied!');
            flashCopied();
          } catch {
            toast.success('Plan published — copy link manually');
            setLabel('Share');
          }
        },
        onError: () => {
          setLabel('Share');
        },
      },
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => void handleClick()}
      disabled={sharePlan.isPending || label === 'Sharing…'}
    >
      <Share2 className="mr-1.5 h-4 w-4" />
      {label}
    </Button>
  );
}
