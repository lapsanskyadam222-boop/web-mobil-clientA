import './globals.css';
import type { ReactNode } from 'react';
import { Manrope } from 'next/font/google';

const manropeRegular = Manrope({
  weight: '400',
  subsets: ['latin-ext'],
  display: 'swap',
  variable: '--font-manrope-regular',
});
const manropeExtraBold = Manrope({
  weight: '800',
  subsets: ['latin-ext'],
  display: 'swap',
  variable: '--font-manrope-extrabold',
});

export const metadata = {
  title: 'Web – logo, carousel, text',
  description: 'Jednoduchý mobilný web s logom, carouselom a textom',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="sk" className={`${manropeRegular.variable} ${manropeExtraBold.variable}`}>
      <body className="min-h-dvh bg-white text-gray-900 antialiased">
        <div className="mx-auto max-w-screen-sm p-4">{children}</div>
      </body>
    </html>
  );
}
