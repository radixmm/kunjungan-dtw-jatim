import { NextResponse } from "next/server";
import { getAdmin } from "@/lib/session";
import { getStats, parseFilter } from "@/lib/stats";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!(await getAdmin())) return NextResponse.json({ error: "perlu_login_admin" }, { status: 401 });
  const data = await getStats(parseFilter(new URL(req.url).searchParams));
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}
