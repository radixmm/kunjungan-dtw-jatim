import { NextResponse } from "next/server";
import { getStaff } from "@/lib/staff";
import { q } from "@/lib/db";
import { wibDate } from "@/lib/time";

// Menerima kumpulan ketukan tombol hitung dari perangkat petugas (bisa terkirim terlambat saat offline).
type Ev = { id: string; dtw: string; t: string; wisnus: number; wisman: number };

export async function POST(req: Request) {
  const st = await getStaff();
  if (!st) return NextResponse.json({ error: "perlu_login" }, { status: 401 });
  const { events } = (await req.json().catch(() => ({}))) as { events?: Ev[] };
  if (!Array.isArray(events)) return NextResponse.json({ error: "format" }, { status: 400 });
  const now = Date.now();
  let ok = 0;
  const done: string[] = [];
  for (const e of events.slice(0, 500)) {
    const t = Date.parse(e.t);
    const valid = typeof e.id === "string" && e.id.length <= 64 && (st.isAdmin || st.dtws.includes(e.dtw))
      && Number.isFinite(t) && t <= now + 300e3 && t >= now - 7 * 86400e3
      && Number.isInteger(e.wisnus) && Number.isInteger(e.wisman) && Math.abs(e.wisnus) <= 200 && Math.abs(e.wisman) <= 200;
    done.push(e.id); // yang tidak sah juga dibuang dari antrean perangkat agar tidak dikirim ulang terus
    if (!valid) continue;
    const r = await q(`INSERT INTO hitung_petugas (client_id, dtw_kode, waktu, tanggal, wisnus, wisman, petugas)
      VALUES ($1, $2, to_timestamp($3::float8 / 1000), $4, $5, $6, $7) ON CONFLICT (client_id) DO NOTHING RETURNING id`,
      [e.id, e.dtw, t, wibDate(new Date(t)), e.wisnus, e.wisman, st.email]);
    ok += r.length;
  }
  return NextResponse.json({ ok, done });
}
