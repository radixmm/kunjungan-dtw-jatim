import { NextResponse } from "next/server";
import { processCheckin, CheckinError, type CheckinInput } from "@/lib/checkin";
import { getVisitor, VISITOR_COOKIE } from "@/lib/session";
import { signSession } from "@/lib/crypto";

export async function POST(req: Request) {
  let body: CheckinInput;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "json_tidak_valid" }, { status: 400 }); }
  try {
    const r = await processCheckin(body, await getVisitor());
    const res = NextResponse.json({ status: r.status, groupCode: r.groupCode, stamps: r.stamps, akun: r.session.m, verified: r.verified });
    res.cookies.set(VISITOR_COOKIE, await signSession(r.session, 180), { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 180 * 86400 });
    return res;
  } catch (e) {
    if (e instanceof CheckinError) return NextResponse.json({ error: e.code }, { status: e.status });
    console.error("checkin gagal", e);
    return NextResponse.json({ error: "server" }, { status: 500 });
  }
}
