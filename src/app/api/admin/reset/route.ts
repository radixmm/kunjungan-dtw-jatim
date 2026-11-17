import { NextResponse } from "next/server";
import { getStaff, logAktivitas } from "@/lib/staff";
import { q } from "@/lib/db";

export const dynamic = "force-dynamic";
const KONFIRMASI = "HAPUS DATA UJI";
const re = /^\d{4}-\d{2}-\d{2}$/;

// Menghapus data uji coba sebelum pilot resmi. Khusus admin provinsi. Akun, periode libur, dan jejak aktivitas tidak dihapus.
async function hitung(sampai: string) {
  const [c, r, h, m] = await Promise.all([
    q<{ n: number }>(`SELECT count(*)::int AS n FROM checkin WHERE visit_date <= $1::date`, [sampai]),
    q<{ n: number }>(`SELECT count(*)::int AS n FROM rekap_harian WHERE tanggal <= $1::date`, [sampai]),
    q<{ n: number }>(`SELECT count(*)::int AS n FROM hitung_petugas WHERE tanggal <= $1::date`, [sampai]),
    q<{ n: number }>(`SELECT count(*)::int AS n FROM laporan_manual`),
  ]);
  return { checkin: c[0].n, rekap: r[0].n, hitung: h[0].n, laporanManual: m[0].n };
}

export async function GET(req: Request) {
  const st = await getStaff();
  if (!st?.isAdmin) return NextResponse.json({ error: "hanya_admin" }, { status: 403 });
  const sampai = new URL(req.url).searchParams.get("sampai") || "";
  if (!re.test(sampai)) return NextResponse.json({ error: "tanggal" }, { status: 400 });
  return NextResponse.json(await hitung(sampai));
}

export async function POST(req: Request) {
  const st = await getStaff();
  if (!st?.isAdmin) return NextResponse.json({ error: "hanya_admin" }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as { sampai?: string; konfirmasi?: string; checkin?: boolean; rekap?: boolean };
  if (b.konfirmasi !== KONFIRMASI) return NextResponse.json({ error: "konfirmasi_salah" }, { status: 400 });
  if (!re.test(b.sampai || "")) return NextResponse.json({ error: "tanggal" }, { status: 400 });
  const before = await hitung(b.sampai!);
  if (b.checkin) await q(`DELETE FROM checkin WHERE visit_date <= $1::date`, [b.sampai]);
  if (b.rekap) {
    await q(`DELETE FROM rekap_harian WHERE tanggal <= $1::date`, [b.sampai]);
    await q(`DELETE FROM hitung_petugas WHERE tanggal <= $1::date`, [b.sampai]);
  }
  await logAktivitas(st.email, "hapus_data_uji", null, { sampai: b.sampai, checkin: b.checkin ? before.checkin : 0, rekap: b.rekap ? before.rekap : 0, hitung: b.rekap ? before.hitung : 0 });
  return NextResponse.json({ ok: true, dihapus: { checkin: b.checkin ? before.checkin : 0, rekap: b.rekap ? before.rekap : 0, hitung: b.rekap ? before.hitung : 0 } });
}
