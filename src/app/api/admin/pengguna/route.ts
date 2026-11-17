import { NextResponse } from "next/server";
import { getStaff, logAktivitas } from "@/lib/staff";
import { q } from "@/lib/db";
import { DTW, KAB } from "@/lib/ref";

export const dynamic = "force-dynamic";
type Row = { id: number; email: string; peran: string; kab: string | null; dtw_kode: string | null; nama: string | null; dibuat_oleh: string | null };

// Admin mengelola semua akun. Verifikator hanya boleh mengelola akun petugas DTW di kab/kotanya.
export async function GET() {
  const st = await getStaff();
  if (!st || (!st.isAdmin && !st.kabs.length)) return NextResponse.json({ error: "perlu_login" }, { status: 401 });
  const rows = await q<Row>(`SELECT id, email, peran, kab, dtw_kode, nama, dibuat_oleh FROM pengguna ORDER BY peran, kab NULLS FIRST, dtw_kode, email`);
  const visible = st.isAdmin ? rows : rows.filter((r) => r.peran === "petugas" && r.dtw_kode && st.kabs.includes(DTW.get(r.dtw_kode)?.kab || ""));
  return NextResponse.json({ rows: visible.map((r) => ({ ...r, dtw_nama: r.dtw_kode ? DTW.get(r.dtw_kode)?.nama : null })) });
}

export async function POST(req: Request) {
  const st = await getStaff();
  if (!st || (!st.isAdmin && !st.kabs.length)) return NextResponse.json({ error: "perlu_login" }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as { email?: string; peran?: string; kab?: string; dtw?: string; nama?: string };
  const email = String(b.email || "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return NextResponse.json({ error: "email_tidak_valid" }, { status: 400 });
  const peran = b.peran;
  let kab: string | null = null, dtw: string | null = null;
  if (peran === "petugas") {
    dtw = String(b.dtw || "");
    const d = DTW.get(dtw);
    if (!d) return NextResponse.json({ error: "dtw_tidak_dikenal" }, { status: 400 });
    if (!st.isAdmin && !st.kabs.includes(d.kab)) return NextResponse.json({ error: "di_luar_wilayah" }, { status: 403 });
  } else if (peran === "verifikator" || peran === "admin") {
    if (!st.isAdmin) return NextResponse.json({ error: "hanya_admin" }, { status: 403 });
    if (peran === "verifikator") { kab = String(b.kab || ""); if (!KAB[kab]) return NextResponse.json({ error: "kab_tidak_dikenal" }, { status: 400 }); }
  } else return NextResponse.json({ error: "peran_tidak_valid" }, { status: 400 });
  await q(`INSERT INTO pengguna (email, peran, kab, dtw_kode, nama, dibuat_oleh) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT DO NOTHING`,
    [email, peran, kab, dtw, String(b.nama || "").slice(0, 100) || null, st.email]);
  await logAktivitas(st.email, "tambah_pengguna", dtw, { email, peran, kab });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const st = await getStaff();
  if (!st || (!st.isAdmin && !st.kabs.length)) return NextResponse.json({ error: "perlu_login" }, { status: 401 });
  const id = Number(new URL(req.url).searchParams.get("id"));
  const [r] = await q<Row>(`SELECT id, email, peran, kab, dtw_kode, nama, dibuat_oleh FROM pengguna WHERE id = $1`, [id]);
  if (!r) return NextResponse.json({ error: "tidak_ada" }, { status: 404 });
  if (!st.isAdmin && !(r.peran === "petugas" && st.kabs.includes(DTW.get(r.dtw_kode || "")?.kab || ""))) return NextResponse.json({ error: "di_luar_wilayah" }, { status: 403 });
  await q(`DELETE FROM pengguna WHERE id = $1`, [id]);
  await logAktivitas(st.email, "hapus_pengguna", r.dtw_kode, { email: r.email, peran: r.peran, kab: r.kab });
  return NextResponse.json({ ok: true });
}
