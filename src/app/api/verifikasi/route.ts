import { NextResponse } from "next/server";
import { getStaff, scopeKodes, canVerify, logAktivitas } from "@/lib/staff";
import { q } from "@/lib/db";
import { addDays, wibDate } from "@/lib/time";
import { getRekap, getLibur, isLibur, syncScanRekap, verifikasiTerlambat, weekStart } from "@/lib/rekap";
import { DTW, jalurOf } from "@/lib/ref";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const st = await getStaff();
  if (!st || (!st.isAdmin && !st.kabs.length)) return NextResponse.json({ error: "perlu_login" }, { status: 401 });
  const today = wibDate();
  const m = new URL(req.url).searchParams.get("minggu");
  const start = weekStart(m && /^\d{4}-\d{2}-\d{2}$/.test(m) ? m : today), end = addDays(start, 6);
  const kodes = scopeKodes(st);
  const histFrom = addDays(today, -35);
  await syncScanRekap(histFrom < start ? histFrom : start, end, kodes);
  const [rows, libur, hist] = await Promise.all([getRekap(start, end, kodes), getLibur(addDays(today, -60), addDays(today, 60)), getRekap(histFrom, today, kodes)]);
  // Tunggakan 35 hari terakhir: rekap belum masuk (jalur petugas) dan belum diverifikasi lewat batas.
  const histMap = new Set(hist.map((r) => r.dtw_kode + r.tanggal));
  const tunggakan: { dtw: string; tanggal: string; jenis: "belum_diisi" | "terlambat_verifikasi" }[] = [];
  for (let d = histFrom; d < today; d = addDays(d, 1)) {
    for (const k of kodes) {
      if (jalurOf(k) === "petugas" && !histMap.has(k + d)) tunggakan.push({ dtw: k, tanggal: d, jenis: "belum_diisi" });
    }
  }
  for (const r of hist) if (r.status === "diajukan" && verifikasiTerlambat(r.tanggal, libur, today)) tunggakan.push({ dtw: r.dtw_kode, tanggal: r.tanggal, jenis: "terlambat_verifikasi" });
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i)).map((d) => ({ tanggal: d, libur: isLibur(d, libur), lewat: d < today }));
  return NextResponse.json({
    start, end, today, days, libur,
    dtw: kodes.map((k) => ({ kode: k, nama: DTW.get(k)?.nama || k, kab: DTW.get(k)?.kab || "", jalur: jalurOf(k), bisaVerifikasi: canVerify(st, k) })),
    rows, tunggakan: tunggakan.sort((a, b) => b.tanggal.localeCompare(a.tanggal)),
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request) {
  const st = await getStaff();
  if (!st || (!st.isAdmin && !st.kabs.length)) return NextResponse.json({ error: "perlu_login" }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as { aksi?: string; items?: { dtw: string; tanggal: string }[]; catatan?: string };
  const aksi = b.aksi === "tolak" ? "ditolak" : b.aksi === "setujui" ? "terverifikasi" : b.aksi === "buka" ? "diajukan" : null;
  if (!aksi || !Array.isArray(b.items) || !b.items.length) return NextResponse.json({ error: "format" }, { status: 400 });
  if (aksi === "ditolak" && !String(b.catatan || "").trim()) return NextResponse.json({ error: "alasan_wajib" }, { status: 400 });
  if (aksi === "diajukan" && !st.isAdmin) return NextResponse.json({ error: "hanya_admin" }, { status: 403 });
  let n = 0;
  for (const it of b.items.slice(0, 400)) {
    if (!canVerify(st, it.dtw) || !/^\d{4}-\d{2}-\d{2}$/.test(it.tanggal)) continue;
    const r = await q(`UPDATE rekap_harian SET status = $3, diverifikasi_oleh = $4, diverifikasi_at = now(), catatan_verifikasi = $5
      WHERE dtw_kode = $1 AND tanggal = $2::date AND status <> $3 RETURNING dtw_kode`,
      [it.dtw, it.tanggal, aksi, aksi === "diajukan" ? null : st.email, aksi === "ditolak" ? String(b.catatan).slice(0, 500) : null]);
    if (r.length) { n++; await logAktivitas(st.email, aksi === "terverifikasi" ? "verifikasi" : aksi === "ditolak" ? "tolak" : "buka_kunci", it.dtw, { tanggal: it.tanggal, catatan: b.catatan || null }); }
  }
  return NextResponse.json({ ok: true, n });
}
