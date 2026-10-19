import type { Metadata, Viewport } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import { ServiceWorkerRegister } from "@/components/sw-register";
import { Toaster } from "@/components/toaster";
import { I18nProvider } from "@/i18n/client";
import { getLocale, getT } from "@/i18n/server";
import { initScope } from "@/lib/auth";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  await initScope();
  const t = getT().common;
  return {
    title: { default: t.appName, template: `%s · ${t.titleSuffix}` },
    description: t.appDescription,
    applicationName: "Finances",
    robots: { index: false, follow: false },
    appleWebApp: { capable: true, title: "Finances", statusBarStyle: "black-translucent" },
    icons: {
      icon: [{ url: "/icon.svg", type: "image/svg+xml" }, { url: "/icons/icon-192.png", sizes: "192x192" }],
      apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
    },
    formatDetection: { telephone: false },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f7f7" },
    { media: "(prefers-color-scheme: dark)", color: "#090909" },
  ],
};

export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  await initScope();
  const locale = getLocale();
  return (
    <html lang={locale} className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="min-h-dvh">
        <I18nProvider locale={locale}>
          {children}
          <Toaster />
        </I18nProvider>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
