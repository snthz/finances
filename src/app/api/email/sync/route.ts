import { revalidatePath } from "next/cache";
import { initScope } from "@/lib/auth";
import { manualSync } from "@/lib/email/manual-sync";

export const dynamic = "force-dynamic";

/** Sincronización manual desde la app (botón, rango de fechas o al conectar un correo). Responde con un FormState. */
export async function POST(request: Request) {
  const user = await initScope();
  if (!user?.onboardedAt) return Response.json({ error: "unauthorized" }, { status: 401 });
  // Sólo JSON: un form de otro sitio no puede enviarlo sin preflight (CSRF)
  if (!request.headers.get("content-type")?.includes("application/json")) return Response.json({ error: "unsupported" }, { status: 415 });
  const result = await manualSync(await request.json().catch(() => null));
  revalidatePath("/", "layout");
  return Response.json(result, { headers: { "Cache-Control": "no-store" } });
}
