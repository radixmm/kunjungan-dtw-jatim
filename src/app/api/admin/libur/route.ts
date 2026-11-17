import { NextResponse } from "next/server";
import { getStaff, logAktivitas } from "@/lib/staff";
import { q } from "@/lib/db";
import { getLibur } from "@/lib/rekap";

export const dynamic = "force-dynamic";

export async function GET() {
  const st = await getStaff();
  if (!st) return NextResponse.json({ error: "perlu_login" }, { status: 401 });
  return NextResponse.json({ rows: await getLibur() });
}
export async function POST(req: Request) {
  const st = await getStaff();
  if (!st?.isAdmin) return NextResponse.json({ error: "hanya_admin" }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as { nama?: string; mulai?: string; selesai?: string };
  const re = /^\d{4}-\d{2}-\d{2}$/;
  if (!b.nama?.trim() || !re.test(b.mulai || "") || !re.test(b.selesai || "") || b.selesai! < b.mulai!) return NextResponse.json({ error: "format" }, { status: 400 });
  await q(`INSERT INTO periode_libur (nama, mulai, selesai, dibuat_oleh) VALUES ($1, $2, $3, $4)`, [b.nama.trim().slice(0, 100), b.mulai, b.selesai, st.email]);
  await logAktivitas(st.email, "tambah_libur", null, b);
  return NextResponse.json({ ok: true });
}
export async function DELETE(req: Request) {
  const st = await getStaff();
  if (!st?.isAdmin) return NextResponse.json({ error: "hanya_admin" }, { status: 403 });
  const id = Number(new URL(req.url).searchParams.get("id"));
  await q(`DELETE FROM periode_libur WHERE id = $1`, [id]);
  await logAktivitas(st.email, "hapus_libur", null, { id });
  return NextResponse.json({ ok: true });
}
