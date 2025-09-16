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

      {/* POZOR: žiadne bg-white ani pevná farba textu.
         Farbu pozadia/textu nastavujú samotné stránky (napr. Home)
         a tu len centrovalo/zarovnávame obsah. */}
      <body className="min-h-dvh antialiased font-sans">
        <div className="mx-auto w-full max-w-screen-sm p-4">
          {children}
        </div>
      </body>
    </html>
  );
}
