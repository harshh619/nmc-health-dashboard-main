import React from 'react';
import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'NMC Disease Surveillance Portal | MSU Nagpur',
  description:
    'Nagpur Municipal Corporation Disease Surveillance Portal powered by Metropolitan Surveillance Unit (MSU Nagpur). Real-time disease monitoring, hot spot detection, and analytics.',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'NMC Surveillance',
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: '/icon-512x512.png',
    apple: '/icon-192x192.png',
  },
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
        <link rel="manifest" href="/manifest.json" />
        <link
          rel="stylesheet"
          href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
        />
      </head>
      <body className="bg-slate-50 min-h-screen antialiased text-slate-900 selection:bg-blue-600 selection:text-white">
        {children}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').then(
                    function(registration) {
                      console.log('ServiceWorker registration successful with scope: ', registration.scope);
                    },
                    function(err) {
                      console.log('ServiceWorker registration failed: ', err);
                    }
                  );
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
