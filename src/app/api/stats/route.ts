import { NextResponse } from "next/server";
import { getStaff, scopeKodes } from "@/lib/staff";
import { getStats, parseFilter } from "@/lib/stats";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const st = await getStaff();
  if (!st || (!st.isAdmin && !st.kabs.length)) return NextResponse.json({ error: "perlu_login_admin" }, { status: 401 });
  const f = parseFilter(new URL(req.url).searchParams);
  if (!st.isAdmin) f.kodes = scopeKodes(st); // verifikator: hanya DTW di kab/kotanya
  const data = await getStats(f);
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}
