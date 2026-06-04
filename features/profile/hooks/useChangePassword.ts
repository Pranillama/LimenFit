'use client';

import * as React from 'react';
import { toast } from 'sonner';

import { createSupabaseBrowserClient } from '@/lib/supabase/browser';

export function useChangePassword() {
  const [isSending, setIsSending] = React.useState(false);

  async function send(email: string | null) {
    if (!email) {
      toast.error('No email on file');
      return;
    }
    setIsSending(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const redirectTo =
        typeof window === 'undefined' ? undefined : `${window.location.origin}/auth/callback`;
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
      if (error) {
        toast.error('Could not send reset link');
        return;
      }
      toast.success('Password reset link sent to your email.');
    } finally {
      setIsSending(false);
    }
  }

  return { send, isSending };
}
