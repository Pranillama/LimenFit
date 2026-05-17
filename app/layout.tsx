import type { Metadata } from 'next';

import { fontSans } from '@/app/fonts';
import { Providers } from '@/app/providers';
import { SystemThemeListener } from '@/features/landing/components/SystemThemeListener';
import { env } from '@/lib/env';
import { cn } from '@/lib/utils';
import '@/styles/globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(env.client.NEXT_PUBLIC_SITE_URL),
  title: 'LimenFit',
  description: 'Fast workout logging. Soon: AI form analysis.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Runs synchronously before first paint to avoid FOUC */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{if(window.matchMedia('(prefers-color-scheme: dark)').matches){document.documentElement.classList.add('dark')}}catch(e){}})()`,
          }}
        />
      </head>
      <body suppressHydrationWarning className={cn('min-h-screen bg-background font-sans antialiased', fontSans.variable)}>
        <SystemThemeListener />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
