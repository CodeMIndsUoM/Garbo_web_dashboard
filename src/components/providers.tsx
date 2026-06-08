'use client';

import { ThemeProvider } from 'next-themes';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={false}
      storageKey="garbo-dashboard-theme"
      disableTransitionOnChange
    >
      {children}
    </ThemeProvider>
  );
}
