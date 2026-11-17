import { NextResponse } from "next/server";
import { verifyGoogleIdToken } from "@/lib/google";
import { signSession } from "@/lib/crypto";
import { ADMIN_COOKIE } from "@/lib/session";
import { rolesFor } from "@/lib/staff";

export async function POST(req: Request) {
  const { credential } = await req.json().catch(() => ({}));
  try {
    const { email } = await verifyGoogleIdToken(String(credential || ""));
    const r = await rolesFor(email);
    if (!r.isAdmin && !r.kabs.length && !r.dtws.length) return NextResponse.json({ error: "bukan_admin" }, { status: 403 });
    const res = NextResponse.json({ ok: true, peran: r.isAdmin ? "admin" : r.kabs.length ? "verifikator" : "petugas" });
    res.cookies.set(ADMIN_COOKIE, await signSession({ email }, 14), { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 14 * 86400 });
    return res;
  } catch {
    return NextResponse.json({ error: "login_tidak_valid" }, { status: 401 });
  }
}
