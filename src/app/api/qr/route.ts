import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { getAdmin } from "@/lib/session";
import { DTW } from "@/lib/ref";
import { qrSigDynamic, qrWindow } from "@/lib/crypto";
import { config } from "@/lib/config";
import { baseUrl } from "@/lib/baseurl";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!(await getAdmin())) return NextResponse.json({ error: "perlu_login_admin" }, { status: 401 });
  const kode = new URL(req.url).searchParams.get("kode") || "";
  if (!DTW.has(kode)) return NextResponse.json({ error: "dtw_tidak_dikenal" }, { status: 404 });
  const t = qrWindow();
  const url = `${await baseUrl()}/c/${kode}?t=${t}&s=${qrSigDynamic(kode, t)}`;
  return NextResponse.json({ img: await QRCode.toDataURL(url, { margin: 2, width: 640 }), expiresAt: (t + 1) * config.qrWindowSec * 1000 }, { headers: { "Cache-Control": "no-store" } });
}
