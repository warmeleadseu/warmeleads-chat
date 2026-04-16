import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { StructuredData } from "@/components/StructuredData";
import { GoogleAnalytics } from "@/components/GoogleAnalytics";
import { FloatingWhatsAppButton } from "@/components/FloatingWhatsAppButton";
import { CookieConsent } from '@/components/CookieConsent';
import "./globals.css";

const inter = Inter({ 
  subsets: ["latin"],
  variable: "--font-inter",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
});

export const metadata: Metadata = {
  title: "Meer Klanten Nodig? | Verse Leads voor Duurzame Energie | WarmeLeads",
  description: "Meer klanten nodig voor uw installatiebedrijf? Krijg exclusieve, gekwalificeerde leads voor thuisbatterijen, zonnepanelen, warmtepompen en airco's. Realtime in jouw portaal. Geen abonnement, betaal per lead.",
  keywords: "meer klanten nodig, klanten werven, nieuwe klanten krijgen, klantacquisitie, klantenwerving, leads kopen, installateur leads, duurzame energie leads, thuisbatterijen leads, zonnepanelen leads, warmtepomp leads, exclusieve klanten, klanten vinden, meer opdrachten, lead generatie Nederland",
  authors: [{ name: "WarmeLeads" }],
  creator: "WarmeLeads",
  publisher: "WarmeLeads",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL("https://www.warmeleads.eu"),
  alternates: {
    canonical: "/",
  },
  icons: {
    icon: [
      { url: "/favicon.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon.ico", sizes: "16x16", type: "image/x-icon" }
    ],
    apple: [
      { url: "/favicon.png", sizes: "180x180", type: "image/png" }
    ],
    shortcut: "/favicon.ico"
  },
  openGraph: {
    title: "Meer Klanten Nodig? | Verse Leads voor Installateurs | WarmeLeads",
    description: "Exclusieve, gekwalificeerde leads voor thuisbatterijen, zonnepanelen, warmtepompen en airco's. Realtime in jouw portaal. Geen abonnement, betaal per lead. Perfect voor installateurs en duurzame energie bedrijven.",
    url: "https://www.warmeleads.eu",
    siteName: "WarmeLeads - Leadgeneratie Nederland",
    locale: "nl_NL",
    type: "website",
    images: [
      {
        url: "https://www.warmeleads.eu/logo-1200x1200.png",
        width: 1200,
        height: 1200,
        alt: "WarmeLeads Logo",
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Meer Klanten Nodig? Exclusieve Leads voor Installateurs",
    description: "Nieuwe klanten voor installateurs: thuisbatterijen, zonnepanelen, warmtepompen, airco's. Exclusieve leads, geen abonnement, betaal per klant.",
    images: ["https://www.warmeleads.eu/logo-1200x1200.png"],
    creator: "@WarmeLeads",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  verification: {
    google: "google03b6b9ca45bfab2e",
    yandex: "yandex-verification-code",
    other: {
      "facebook-domain-verification": "facebook-domain-verification-code",
    },
  },
  category: "Lead Generation",
  classification: "Business Services",
  referrer: "origin-when-cross-origin",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="nl" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <head>
        <link rel="dns-prefetch" href="//fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.googleapis.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#3B2F75" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5, user-scalable=yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="WarmeLeads" />
        <meta name="msapplication-TileColor" content="#3B2F75" />
        <meta name="msapplication-tap-highlight" content="no" />
      </head>
      <body className="antialiased">
        <GoogleAnalytics />
        <StructuredData />
        <ErrorBoundary>
          <div id="root">
            {children}
          </div>
        </ErrorBoundary>
        <FloatingWhatsAppButton />
        <CookieConsent />
      </body>
    </html>
  );
}