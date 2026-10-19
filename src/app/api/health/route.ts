import { sql } from "drizzle-orm";
import { db } from "@/db";
import { isReady } from "@/lib/startup";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await db.execute(sql`select 1`);
    return Response.json({ ok: true, ready: isReady() });
  } catch {
    return Response.json({ ok: false, ready: false }, { status: 503 });
  }
}
