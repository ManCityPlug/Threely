import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import { ThemeProvider } from "@/lib/theme-context";
import MobileAppPrompt from "@/components/MobileAppPrompt";

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

// Microsoft Clarity analytics
const clarityScript = `(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y)})(window,document,"clarity","script","vn46r6mmmo")`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <script dangerouslySetInnerHTML={{ __html: clarityScript }} />
      </head>
      <body>
        <ThemeProvider>
          <AuthProvider>
            {children}
            <MobileAppPrompt />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
