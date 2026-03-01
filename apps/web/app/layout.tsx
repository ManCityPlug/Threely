import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import { ThemeProvider } from "@/lib/theme-context";
import MobileAppPrompt from "@/components/MobileAppPrompt";

export const metadata: Metadata = {
  title: {
    default: "Threely — AI-Powered Daily Tasks for Any Goal",
    template: "%s | Threely",
  },
  description:
    "Describe your goal, get 3 personalized tasks every day. Threely adapts to your schedule, skill level, and progress — like a coach that never sleeps.",
  openGraph: {
    siteName: "Threely",
    type: "website",
    url: "https://threely.co",
    title: "Threely — AI-Powered Daily Tasks for Any Goal",
    description: "Describe your goal, get 3 personalized tasks every day. Threely adapts to your schedule, skill level, and progress.",
    images: [{ url: "https://threely.co/favicon.png" }],
  },
  twitter: {
    card: "summary",
    title: "Threely — AI-Powered Daily Tasks for Any Goal",
    description: "Describe your goal, get 3 personalized tasks every day. Threely adapts to your schedule, skill level, and progress.",
  },
  icons: {
    icon: "/favicon.png",
    apple: "/icon-192x192.png",
  },
  manifest: "/manifest.json",
};

// Inline script to prevent flash of wrong theme on page load
const themeScript = `(function(){try{var t=localStorage.getItem('threely-theme')||'light';document.documentElement.setAttribute('data-theme',t)}catch(e){}})()`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <ThemeProvider>
          <AuthProvider>
            {children}
            <MobileAppPrompt />
          </AuthProvider>
        </ThemeProvider>
        {/* Analytics — loaded via next/script for reliable execution */}
        <Script
          id="microsoft-clarity"
          strategy="afterInteractive"
        >{`(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y)})(window,document,"clarity","script","vn46r6mmmo");`}</Script>
      </body>
    </html>
  );
}
