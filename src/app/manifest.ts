import type { MetadataRoute } from "next";
import { getLocale, getT } from "@/i18n/server";
import { initScope } from "@/lib/auth";

// Depende del idioma de Ajustes: no se puede pre-renderizar en el build
export const dynamic = "force-dynamic";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  await initScope();
  const t = getT().common;
  return {
    id: "/",
    name: t.manifestName,
    short_name: t.appName,
    description: t.manifestDescription,
    lang: getLocale(),
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0d0d0d",
    theme_color: "#0a0a0a",
    categories: ["finance", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: t.nav.newTransaction, short_name: t.nav.newShort, url: "/transactions?new=1", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: t.nav.transactions, url: "/transactions", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
