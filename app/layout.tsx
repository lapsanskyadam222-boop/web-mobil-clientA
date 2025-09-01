import './globals.css';
import type { ReactNode } from 'react';
import { Inter } from 'next/font/google';

const inter = Inter({
  subsets: ['latin'],
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
    <html lang="sk" className={inter.className}>
      <body className="min-h-dvh bg-white text-gray-900 antialiased">
        <div className="mx-auto max-w-screen-sm p-4">{children}</div>
      </body>
    </html>
  );
}
