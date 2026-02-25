import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import { ThemeProvider } from "@/lib/theme-context";
import MobileAppPrompt from "@/components/MobileAppPrompt";
import ClarityInit from "@/components/ClarityInit";
import ClarityInit from "@/components/ClarityInit";

export const metadata: Metadata = {
  title: "Threely — Your AI coach",
  description:
    "Turn your goals into personalized daily tasks with AI coaching. Threely builds smart, actionable plans tailored to your life.",
  icons: {
    icon: "/favicon.png",
  },
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
        <ClarityInit />
        <ThemeProvider>
          <AuthProvider>
            {children}
            <MobileAppPrompt />
            <ClarityInit />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
