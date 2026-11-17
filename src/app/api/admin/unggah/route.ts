import { NextResponse } from "next/server";
import { getStaff, logAktivitas } from "@/lib/staff";
import { q } from "@/lib/db";
import { DTW } from "@/lib/ref";

// Unggah data sistem tiket online (mis. rekap TNBTS) dalam CSV: tanggal,kode_dtw,wisnus,wisman
// Data dari sumber resmi pengelola langsung berstatus terverifikasi.
export async function POST(req: Request) {
  const st = await getStaff();
  if (!st?.isAdmin) return NextResponse.json({ error: "hanya_admin" }, { status: 403 });
  const { csv, sumber } = (await req.json().catch(() => ({}))) as { csv?: string; sumber?: string };
  const label = String(sumber || "sistem tiket online").slice(0, 80);
  const lines = String(csv || "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const errors: string[] = [];
  let n = 0;
  for (const [i, line] of lines.entries()) {
    const c = line.split(/[;,\t]/).map((x) => x.trim().replace(/^"|"$/g, ""));
    if (i === 0 && /tanggal/i.test(c[0])) continue;
    const [tanggal, kode, wn, wm] = c;
    const wisnus = Number(String(wn).replace(/\./g, "")), wisman = Number(String(wm || "0").replace(/\./g, ""));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggal) || !DTW.has(kode) || !Number.isInteger(wisnus) || !Number.isInteger(wisman) || wisnus < 0 || wisman < 0) {
      errors.push(`Baris ${i + 1}: "${line.slice(0, 60)}"`); continue;
    }
    await q(`INSERT INTO rekap_harian (dtw_kode, tanggal, wisnus, wisman, sumber, catatan, diisi_oleh, diisi_at, status, diverifikasi_oleh, diverifikasi_at)
      VALUES ($1, $2, $3, $4, 'online', $5, $6, now(), 'terverifikasi', $5, now())
      ON CONFLICT (dtw_kode, tanggal) DO UPDATE SET wisnus = EXCLUDED.wisnus, wisman = EXCLUDED.wisman, sumber = 'online', catatan = EXCLUDED.catatan,
        diisi_oleh = EXCLUDED.diisi_oleh, diisi_at = now(), status = 'terverifikasi', diverifikasi_oleh = EXCLUDED.diverifikasi_oleh, diverifikasi_at = now()`,
      [kode, tanggal, wisnus, wisman, label, st.email]);
    n++;
  }
  await logAktivitas(st.email, "unggah_online", null, { baris: n, sumber: label, gagal: errors.length });
  return NextResponse.json({ ok: true, n, errors: errors.slice(0, 20) });
}
