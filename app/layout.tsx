import React from 'react';
import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'NMC Disease Surveillance Portal | MSU Nagpur',
  description:
    'Nagpur Municipal Corporation Disease Surveillance Portal powered by Metropolitan Surveillance Unit (MSU Nagpur). Real-time disease monitoring, hot spot detection, and analytics.',
  manifest: '/manifest.json',
};

export const viewport: import('next').Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#1e3a8a',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link
          rel="stylesheet"
          href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
        />
      </head>
      <body className="bg-slate-50 min-h-screen antialiased text-slate-900 selection:bg-blue-600 selection:text-white">
        {children}
      </body>
    </html>
  );
}
