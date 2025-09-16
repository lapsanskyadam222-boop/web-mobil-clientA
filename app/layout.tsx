import './globals.css';
import type { ReactNode } from 'react';

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
    <html lang="sk">
      <head>
        {/* Google Fonts: Manrope */}
        <link
          href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;800&display=swap"
          rel="stylesheet"
        />
      </head>
      {/* Z tela dáme preč bg-white + wrapper.
          Stránky si už samé riešia vnútorné rozloženie */}
      <body className="min-h-dvh antialiased font-sans">
        {children}
      </body>
    </html>
  );
}
