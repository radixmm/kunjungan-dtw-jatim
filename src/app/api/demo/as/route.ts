import { NextResponse } from "next/server";
import { isDemo } from "@/lib/config";
import { DEMO_AS_COOKIE } from "@/lib/staff";

// Mode demo saja: berpindah peran (admin / verifikator kab-kota / petugas DTW) untuk mencoba tampilan.
export async function POST(req: Request) {
  if (!isDemo()) return NextResponse.json({ error: "hanya_mode_demo" }, { status: 403 });
  const { as } = (await req.json().catch(() => ({}))) as { as?: string };
  const res = NextResponse.json({ ok: true });
  res.cookies.set(DEMO_AS_COOKIE, String(as || "admin").slice(0, 80), { path: "/", sameSite: "lax", maxAge: 86400 });
  return res;
}
