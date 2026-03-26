import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import { ThemeProvider } from "@/lib/theme-context";

export const metadata: Metadata = {
  metadataBase: new URL("https://threely.co"),
  title: {
    default: "Threely — Do Less, Achieve More",
    template: "%s | Threely",
  },
  description:
    "Turn your goals into personalized daily tasks with AI coaching. Threely builds smart, actionable plans tailored to your life.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    siteName: "Threely",
    type: "website",
    url: "https://threely.co",
    title: "Threely — Do Less, Achieve More",
    description:
      "Turn your goals into personalized daily tasks with AI coaching. Threely builds smart, actionable plans tailored to your life.",
    images: [{ url: "/og-image.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Threely — Do Less, Achieve More",
    description:
      "Turn your goals into personalized daily tasks with AI coaching. Threely builds smart, actionable plans tailored to your life.",
    images: ["/og-image.png"],
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-48x48.png", sizes: "48x48", type: "image/png" },
      { url: "/favicon-96x96.png", sizes: "96x96", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  manifest: "/site.webmanifest",
};

// Inline script to prevent flash of wrong theme on page load
const themeScript = `(function(){try{var t=localStorage.getItem('threely-theme')||'light';document.documentElement.setAttribute('data-theme',t)}catch(e){}})()`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@graph": [
                {
                  "@type": "WebApplication",
                  name: "Threely",
                  url: "https://threely.co",
                  description:
                    "AI-powered goal coaching app that generates 3 personalized daily tasks based on your goals, schedule, and progress.",
                  applicationCategory: "ProductivityApplication",
                  operatingSystem: "iOS, Android, Web",
                  offers: {
                    "@type": "Offer",
                    price: "0",
                    priceCurrency: "USD",
                    description: "7-day free trial",
                  },
                },
                {
                  "@type": "Organization",
                  name: "Threely",
                  url: "https://threely.co",
                  logo: "https://threely.co/favicon-96x96.png",
                },
              ],
            }),
          }}
        />
      </head>
      <body>
        <ThemeProvider>
          <AuthProvider>
            {children}
          </AuthProvider>
        </ThemeProvider>
        {/* Analytics — loaded via next/script for reliable execution */}
        <Script
          id="microsoft-clarity"
          strategy="afterInteractive"
        >{`(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y)})(window,document,"clarity","script","vn46r6mmmo");`}</Script>
        {/* Crisp live chat */}
        <Script
          id="crisp-chat"
          strategy="afterInteractive"
        >{`window.$crisp=[];window.CRISP_WEBSITE_ID="498b2c8b-bec0-4790-a2bb-795f9c295898";(function(){var d=document,s=d.createElement("script");s.src="https://client.crisp.chat/l.js";s.async=1;d.getElementsByTagName("head")[0].appendChild(s)})();`}</Script>
      </body>
    </html>
  );
}
