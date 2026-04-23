import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import Script from 'next/script';
import { ThemeProvider } from '@/components/ThemeProvider';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

// GTM_ID is read at build/request time from env.
// Set NEXT_PUBLIC_GTM_ID=GTM-XXXXXXX in .env.local (or Vercel env vars).
const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID;
const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ?? 'G-CFPS9G0HHJ';

export const metadata: Metadata = {
  title: 'Florida Mountain Bike Trail Guided Tours',
  description: 'Guided mountain bike and paved trail tours across Central Florida.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* ── Google Analytics 4 ── */}
        <Script
          id="ga-script"
          strategy="afterInteractive"
          src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
        />
        <Script
          id="ga-config"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${GA_ID}');
            `,
          }}
        />
        {/* ── Google Tag Manager ── */}
        {GTM_ID && (
          <Script
            id="gtm-script"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: `
                (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
                new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
                j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
                'https://www.googletagmanager.com/gtm.js?id='+i+dl;
                f.parentNode.insertBefore(j,f);
                })(window,document,'script','dataLayer','${GTM_ID}');
              `,
            }}
          />
        )}
      </head>
      <body className={inter.className}>
        {/* ── GTM noscript fallback ── */}
        {GTM_ID && (
          <noscript>
            <iframe
              src={`https://www.googletagmanager.com/ns.html?id=${GTM_ID}`}
              height="0"
              width="0"
              style={{ display: 'none', visibility: 'hidden' }}
            />
          </noscript>
        )}
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
