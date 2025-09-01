// app/layout.tsx
import './globals.css';
import type { ReactNode } from 'react';
import { Inter } from 'next/font/google';

// načítame Inter priamo cez Next.js (bez ručného <link>)
const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

export const metadata = {
  title: 'Web – logo, carousel, text',
  description: 'Jednoduchý mobilný web s logom, carouselom a textom',
};

// Next.js vyžaduje viewport v samostatnom exporte (nie v metadata)
export const viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // inter.className pridá do <html> správny font-family pre celý web
    <html lang="sk" className={inter.className}>
      <body className="min-h-dvh bg-white text-gray-900 antialiased">
        <div className="mx-auto max-w-screen-sm p-4">{children}</div>
      </body>
    </html>
  );
}
