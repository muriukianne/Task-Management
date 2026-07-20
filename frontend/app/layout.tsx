import type { Metadata } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import { Geist, Geist_Mono } from 'next/font/google';
import Providers from './components/providers/Providers';
import './globals.css';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'TaskFlow',
  description: 'Professional task management for modern teams',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html
        lang="en"
        suppressHydrationWarning
        className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      >
        {/* Anti-FOUC: apply saved theme before React hydrates */}
        <head>
          <script
            dangerouslySetInnerHTML={{
              __html: `
              try {
                const t = localStorage.getItem('tm_theme');
                const prefer = window.matchMedia('(prefers-color-scheme: dark)').matches;
                if (t === 'dark' || (!t && prefer)) document.documentElement.classList.add('dark');
              } catch {}
            `,
            }}
          />
        </head>
        <body className="min-h-full flex flex-col bg-[var(--bg)] text-[var(--text-primary)] antialiased">
          <Providers>{children}</Providers>
        </body>
      </html>
    </ClerkProvider>
  );
}