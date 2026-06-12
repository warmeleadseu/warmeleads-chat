import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { StructuredData } from "@/components/StructuredData";
import { GoogleAnalytics } from "@/components/GoogleAnalytics";
import { DeferredGlobals } from "@/components/DeferredGlobals";
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
  description: "Meer klanten nodig voor je installatiebedrijf? Krijg exclusieve, gekwalificeerde leads voor thuisbatterijen, zonnepanelen, warmtepompen en airco's. Realtime in jouw portaal. Geen abonnement, betaal per lead.",
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
      { url: "/favicon.ico", sizes: "48x48", type: "image/x-icon" },
      { url: "/favicon.png", sizes: "32x32", type: "image/png" }
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }
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
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5, user-scalable=yes, viewport-fit=cover" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="WarmeLeads" />
        <meta name="msapplication-TileColor" content="#3B2F75" />
        <meta name="msapplication-tap-highlight" content="no" />
        {/*
          Recovery-script voor iOS Safari:
          1) Reload bij BFCache-restore (pageshow met persisted=true). Voorkomt
             dat Safari een gerestorede pagina toont waarvan de _next/static-
             chunks inmiddels door een nieuwe deploy zijn vervangen.
          2) Detecteert verouderde Service Workers (uit pre-v5 versies die wel
             een fetch-handler hadden). Als de actieve SW niet binnen 1.5s
             reageert op een version-probe, of een oude versie reporteert,
             worden alle SW's en caches opgeruimd en wordt de pagina opnieuw
             geladen. SessionStorage-flag voorkomt reload-loops.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{
var EXPECTED='warmeleads-v5-push-only';
var FLAG='wl-sw-checked-v5';
var RELOAD_FLAG='wl-sw-reloaded-v5';
window.addEventListener('pageshow',function(e){
  if(e.persisted){try{sessionStorage.removeItem(FLAG);}catch(_){}}
  if(e.persisted){location.reload();}
});
if(typeof navigator==='undefined'||!('serviceWorker' in navigator))return;
try{if(sessionStorage.getItem(FLAG)==='1')return;}catch(_){}
var triggered=false;
function recover(){
  if(triggered)return;triggered=true;
  try{sessionStorage.setItem(FLAG,'1');}catch(_){}
  var alreadyReloaded=false;
  try{alreadyReloaded=sessionStorage.getItem(RELOAD_FLAG)==='1';}catch(_){}
  navigator.serviceWorker.getRegistrations().then(function(regs){
    return Promise.all(regs.map(function(r){return r.unregister().catch(function(){});}));
  }).then(function(){
    if(typeof caches==='undefined')return;
    return caches.keys().then(function(keys){
      return Promise.all(keys.map(function(k){return caches.delete(k).catch(function(){});}));
    });
  }).then(function(){
    if(alreadyReloaded)return;
    try{sessionStorage.setItem(RELOAD_FLAG,'1');}catch(_){}
    location.reload();
  }).catch(function(){});
}
function markOk(){
  try{sessionStorage.setItem(FLAG,'1');}catch(_){}
  try{sessionStorage.removeItem(RELOAD_FLAG);}catch(_){}
}
navigator.serviceWorker.getRegistrations().then(function(regs){
  if(!regs||regs.length===0){markOk();return;}
  var ctrl=navigator.serviceWorker.controller;
  if(!ctrl){
    Promise.all(regs.map(function(r){return r.update().catch(function(){});})).then(function(){markOk();});
    return;
  }
  var done=false;
  var probeTimeout=setTimeout(function(){if(done)return;done=true;recover();},1500);
  function onMessage(ev){
    if(!ev||!ev.data||ev.data.type!=='wl-sw-version')return;
    if(done)return;done=true;clearTimeout(probeTimeout);
    navigator.serviceWorker.removeEventListener('message',onMessage);
    if(ev.data.value===EXPECTED){markOk();}
    else{recover();}
  }
  navigator.serviceWorker.addEventListener('message',onMessage);
  try{ctrl.postMessage({type:'getVersion'});}catch(_){clearTimeout(probeTimeout);recover();}
}).catch(function(){markOk();});
}catch(_){}})();`,
          }}
        />
      </head>
      <body className="antialiased">
        <GoogleAnalytics />
        <StructuredData />
        <ErrorBoundary>
          <div id="root">
            {children}
          </div>
        </ErrorBoundary>
        <DeferredGlobals />
      </body>
    </html>
  );
}