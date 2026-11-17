import { NextResponse } from "next/server";
import { getStaff, logAktivitas } from "@/lib/staff";
import { q } from "@/lib/db";
import { addDays, wibDate } from "@/lib/time";
import { jalurOf } from "@/lib/ref";

// Petugas mengirim / memperbaiki rekap harian. Rekap yang sudah diverifikasi terkunci.
export async function POST(req: Request) {
  const st = await getStaff();
  if (!st) return NextResponse.json({ error: "perlu_login" }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as { dtw?: string; tanggal?: string; wisnus?: number; wisman?: number; catatan?: string };
  const dtw = String(b.dtw || ""), tanggal = String(b.tanggal || "");
  if (!st.isAdmin && !st.dtws.includes(dtw)) return NextResponse.json({ error: "bukan_dtw_anda" }, { status: 403 });
  if (jalurOf(dtw) !== "petugas") return NextResponse.json({ error: "dtw_bukan_jalur_petugas" }, { status: 400 });
  const today = wibDate();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggal) || tanggal > today || tanggal < addDays(today, -31)) return NextResponse.json({ error: "tanggal_tidak_valid" }, { status: 400 });
  const wisnus = Math.floor(Number(b.wisnus)), wisman = Math.floor(Number(b.wisman));
  if (!(wisnus >= 0 && wisnus <= 500000 && wisman >= 0 && wisman <= 100000)) return NextResponse.json({ error: "angka_tidak_valid" }, { status: 400 });
  const catatan = String(b.catatan || "").slice(0, 500) || null;
  const r = await q<{ status: string }>(`
    INSERT INTO rekap_harian (dtw_kode, tanggal, wisnus, wisman, sumber, catatan, diisi_oleh, diisi_at, status)
    VALUES ($1, $2, $3, $4, 'petugas', $5, $6, now(), 'diajukan')
    ON CONFLICT (dtw_kode, tanggal) DO UPDATE SET wisnus = EXCLUDED.wisnus, wisman = EXCLUDED.wisman, catatan = EXCLUDED.catatan,
      diisi_oleh = EXCLUDED.diisi_oleh, diisi_at = now(), status = 'diajukan', catatan_verifikasi = NULL
    WHERE rekap_harian.status <> 'terverifikasi'
    RETURNING status`, [dtw, tanggal, wisnus, wisman, catatan, st.email]);
  if (!r.length) return NextResponse.json({ error: "sudah_diverifikasi" }, { status: 409 });
  await logAktivitas(st.email, "kirim_rekap", dtw, { tanggal, wisnus, wisman });
  return NextResponse.json({ ok: true });
}
