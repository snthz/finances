import { notificationsSnapshot, runPaymentScheduler } from "@/lib/payments";
import { initScope } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Avisos de la campanita (la consulta el cliente cada minuto). */
export async function GET() {
  if (!(await initScope())) return Response.json({ error: "unauthorized" }, { status: 401 });
  await runPaymentScheduler();
  return Response.json(await notificationsSnapshot(), { headers: { "Cache-Control": "no-store" } });
}
