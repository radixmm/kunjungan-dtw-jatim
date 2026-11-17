import { NextResponse } from "next/server";
import { getVisitor, VISITOR_COOKIE } from "@/lib/session";
import { q } from "@/lib/db";

// Hak subjek data (UU 27/2022): tautan pengunjung diputus dengan mengganti visitor_hash dengan nilai acak
// per baris. Angka agregat tetap, tetapi baris tidak lagi bisa dihubungkan ke akun atau satu sama lain.
export async function POST() {
  const v = await getVisitor();
  if (!v) return NextResponse.json({ error: "tidak_ada_sesi" }, { status: 401 });
  const r = await q<{ id: number }>(`UPDATE checkin SET visitor_hash = 'anon:' || md5(random()::text || id::text) WHERE visitor_hash = $1 RETURNING id`, [v.v]);
  await q(`INSERT INTO permintaan_subjek (jenis, jumlah) VALUES ('hapus', $1)`, [r.length]);
  const res = NextResponse.json({ ok: true, jumlah: r.length });
  res.cookies.delete(VISITOR_COOKIE);
  return res;
}
