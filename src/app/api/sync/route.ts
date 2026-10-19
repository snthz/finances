import { timingSafeEqual } from "node:crypto";
import { syncEveryone } from "@/lib/email/sync";

export const dynamic = "force-dynamic";

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const a = Buffer.from(token);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Disparo externo opcional: curl -X POST -H "Authorization: Bearer $CRON_SECRET" .../api/sync */
export async function POST(request: Request) {
  if (!authorized(request)) return Response.json({ error: "unauthorized" }, { status: 401 });
  const results = await syncEveryone();
  return Response.json(results, { status: results.every((r) => r.ok) ? 200 : 500 });
}
