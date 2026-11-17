import { NextResponse } from "next/server";
import { verifyGoogleIdToken } from "@/lib/google";
import { signSession } from "@/lib/crypto";
import { ADMIN_COOKIE, isAdminEmail } from "@/lib/session";

export async function POST(req: Request) {
  const { credential } = await req.json().catch(() => ({}));
  try {
    const { email } = await verifyGoogleIdToken(String(credential || ""));
    if (!isAdminEmail(email)) return NextResponse.json({ error: "bukan_admin" }, { status: 403 });
    const res = NextResponse.json({ ok: true });
    res.cookies.set(ADMIN_COOKIE, await signSession({ role: "admin", email }, 1), { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 86400 });
    return res;
  } catch {
    return NextResponse.json({ error: "login_tidak_valid" }, { status: 401 });
  }
}
