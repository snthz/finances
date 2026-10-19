import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { getT } from "@/i18n/server";
import { initScope } from "@/lib/auth";

export async function generateMetadata(): Promise<Metadata> {
  await initScope();
  const t = getT().legal.termsDoc;
  return { title: t.metaTitle, description: t.metaDescription, robots: { index: true, follow: true } };
}

/** Términos del servicio (pública). */
export default async function TermsPage() {
  await initScope();
  const t = getT().legal;
  return <LegalPage doc={t.termsDoc} t={t} />;
}
