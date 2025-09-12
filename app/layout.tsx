import './globals.css';
import type { ReactNode } from 'react';
import { Manrope } from 'next/font/google';

export const metadata = {
  title: 'Web – logo, carousel, text',
  description: 'Jednoduchý mobilný web s logom, carouselom a textom',
};

// Next.js vyžaduje viewport v samostatnom exporte (nie v metadata)
export const viewport = {
  width: 'device-width',
  initialScale: 1,
};

// Google font – Manrope (Regular 400, ExtraBold 800)
const manrope = Manrope({
  subsets: ['latin'],
  weight: ['400', '800'],
  variable: '--font-manrope',
  display: 'swap',
});

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="sk" className={manrope.variable}>
      <body className="min-h-dvh bg-white text-gray-900 antialiased">
        <div className="mx-auto max-w-screen-sm p-4">{children}</div>
      </body>
    </html>
  );
}
