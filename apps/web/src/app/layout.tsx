import type { Metadata, Viewport } from "next";
import { Inter, Outfit } from "next/font/google";
import "./globals.css";
import { RegisterPwa } from "@/components/pwa-register";
import { ThemeProvider } from "@/components/theme-provider";
import { SyncProvider } from "@/lib/sync";
import { THEME_COLOR, THEME_COLOR_DARK } from "@/lib/theme-color";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

export const viewport: Viewport = {
  // The installed app's chrome uses the manifest's colour, so the light scheme shares it.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: THEME_COLOR },
    { media: "(prefers-color-scheme: dark)", color: THEME_COLOR_DARK },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "College Ess — Student Life Platform",
  description: "Student life platform for wardrobe, routines, habits, exams, and campus guidance.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "College Ess",
  },
  formatDetection: {
    telephone: false,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${outfit.variable}`}>
      <body className="antialiased min-h-screen bg-[var(--surface-canvas)] text-[var(--text-primary)]">
        <ThemeProvider>
          <SyncProvider>
            {children}
            <RegisterPwa />
          </SyncProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
