import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { getT } from "@/i18n/server";
import { initScope } from "@/lib/auth";

export async function generateMetadata(): Promise<Metadata> {
  await initScope();
  const t = getT().legal.privacyDoc;
  return { title: t.metaTitle, description: t.metaDescription, robots: { index: true, follow: true } };
}

/** Política de privacidad (pública). */
export default async function PrivacyPage() {
  await initScope();
  const t = getT().legal;
  return <LegalPage doc={t.privacyDoc} t={t} />;
}
