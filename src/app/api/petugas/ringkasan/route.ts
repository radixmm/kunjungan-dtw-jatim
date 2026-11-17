import { NextResponse } from "next/server";
import { getStaff } from "@/lib/staff";
import { q } from "@/lib/db";
import { addDays, wibDate } from "@/lib/time";
import { getRekap, getLibur, isLibur } from "@/lib/rekap";

export const dynamic = "force-dynamic";

// Ringkasan untuk layar petugas: total tombol hitung per tanggal (14 hari) dan status rekap hariannya.
export async function GET(req: Request) {
  const st = await getStaff();
  if (!st) return NextResponse.json({ error: "perlu_login" }, { status: 401 });
  const dtw = new URL(req.url).searchParams.get("dtw") || "";
  if (!st.isAdmin && !st.dtws.includes(dtw)) return NextResponse.json({ error: "bukan_dtw_anda" }, { status: 403 });
  const today = wibDate(), from = addDays(today, -13);
  const [hitung, perJam, rekap, libur] = await Promise.all([
    q<{ tanggal: string; wisnus: number; wisman: number }>(`SELECT tanggal::text AS tanggal, sum(wisnus)::int AS wisnus, sum(wisman)::int AS wisman
      FROM hitung_petugas WHERE dtw_kode = $1 AND tanggal >= $2::date GROUP BY 1`, [dtw, from]),
    q<{ jam: number; n: number }>(`SELECT extract(hour FROM waktu AT TIME ZONE 'Asia/Jakarta')::int AS jam, sum(wisnus + wisman)::int AS n
      FROM hitung_petugas WHERE dtw_kode = $1 AND tanggal = $2::date GROUP BY 1 ORDER BY 1`, [dtw, today]),
    getRekap(from, today, [dtw]),
    getLibur(from, today),
  ]);
  const hm = new Map(hitung.map((h) => [h.tanggal, h])), rm = new Map(rekap.map((r) => [r.tanggal, r]));
  const hari = Array.from({ length: 14 }, (_, i) => addDays(today, -i)).map((d) => ({
    tanggal: d, libur: isLibur(d, libur), hitung: hm.get(d) || { wisnus: 0, wisman: 0 }, rekap: rm.get(d) || null,
  }));
  return NextResponse.json({ today, hari, perJam }, { headers: { "Cache-Control": "no-store" } });
}
