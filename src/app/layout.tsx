import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/sonner";
import { Providers } from '@/components/providers';

export const metadata: Metadata = {
  title: 'Garbage Management Dashboard',
  description: 'Garbo - Waste Management System',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans antialiased" suppressHydrationWarning>
        <Providers>
          {children}
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
