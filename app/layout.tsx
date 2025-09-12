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
        {/* Google Fonts: Manrope (Regular 400, ExtraBold 800) */}
        <link
          href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;800&display=swap"
          rel="stylesheet"
        />
      </head>
      {/* ⚠️ Odstránené bg-white a text-gray-900, aby farba z /api/content prekryla celý viewport */}
      <body className="min-h-dvh antialiased font-sans">
        <div className="mx-auto max-w-screen-sm p-4">{children}</div>
      </body>
    </html>
  );
}
