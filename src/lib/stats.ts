import { q } from "./db";
import { config } from "./config";
import { DTW, PILOT, wilayahDtw, dppLabel, ksppLabel, namaProv, namaKabAsal } from "./ref";
import { wibDate, addDays } from "./time";

export type Filter = { from: string; to: string; mutu: "semua" | "terverifikasi"; dtw?: string };

const DATE = /^\d{4}-\d{2}-\d{2}$/;
export function parseFilter(sp: URLSearchParams): Filter {
  const today = wibDate();
  const from = DATE.test(sp.get("from") || "") ? sp.get("from")! : today;
  const to = DATE.test(sp.get("to") || "") ? sp.get("to")! : today;
  const dtw = sp.get("dtw") || undefined;
  return { from, to: to < from ? from : to, mutu: sp.get("mutu") === "terverifikasi" ? "terverifikasi" : "semua", dtw: dtw && DTW.has(dtw) ? dtw : undefined };
}

// Klausa WHERE bersama. "Terverifikasi" = lokasi cocok dan tanpa bendera perjalanan mustahil.
function where(f: Filter, alias = "") {
  const a = alias ? alias + "." : "";
  const params: unknown[] = [f.from, f.to];
  let w = `${a}visit_date BETWEEN $1::date AND $2::date`;
  if (f.mutu === "terverifikasi") w += ` AND ${a}geo_status = 'ok' AND position('perjalanan_mustahil' in ${a}flags) = 0`;
  if (f.dtw) { params.push(f.dtw); w += ` AND ${a}dtw_kode = $${params.length}`; }
  return { w, params };
}

type Agg = { pax: number; wisnus: number; wisman: number; checkin: number };
const empty = (): Agg => ({ pax: 0, wisnus: 0, wisman: 0, checkin: 0 });
const add = (a: Agg, b: Agg) => { a.pax += b.pax; a.wisnus += b.wisnus; a.wisman += b.wisman; a.checkin += b.checkin; };

export async function getStats(f: Filter) {
  const { w, params } = where(f);
  const sum = `sum(pax)::int AS pax, sum(CASE WHEN asal_tipe='wisnus' THEN pax ELSE 0 END)::int AS wisnus,
               sum(CASE WHEN asal_tipe='wisman' THEN pax ELSE 0 END)::int AS wisman, count(*)::int AS checkin`;
  const single = f.from === f.to;

  const [tot, byDtw, byKat, series, prov, kab, neg, mutu, feed, guide] = await Promise.all([
    q<Agg & { visitors: number; geo_ok: number; demo: number }>(`SELECT ${sum}, count(DISTINCT visitor_hash)::int AS visitors,
        sum(CASE WHEN geo_status='ok' THEN 1 ELSE 0 END)::int AS geo_ok, sum(CASE WHEN demo THEN 1 ELSE 0 END)::int AS demo FROM checkin WHERE ${w}`, params),
    q<Agg & { dtw_kode: string; geo_ok: number }>(`SELECT dtw_kode, ${sum}, sum(CASE WHEN geo_status='ok' THEN 1 ELSE 0 END)::int AS geo_ok FROM checkin WHERE ${w} GROUP BY dtw_kode`, params),
    q<Agg & { kategori: string }>(`SELECT kategori, ${sum} FROM checkin WHERE ${w} GROUP BY kategori`, params),
    single
      ? q<Agg & { k: string }>(`SELECT lpad(extract(hour FROM visit_at AT TIME ZONE 'Asia/Jakarta')::int::text, 2, '0') AS k, ${sum} FROM checkin WHERE ${w} GROUP BY 1 ORDER BY 1`, params)
      : q<Agg & { k: string }>(`SELECT visit_date::text AS k, ${sum} FROM checkin WHERE ${w} GROUP BY 1 ORDER BY 1`, params),
    q<{ k: string; pax: number }>(`SELECT asal_prov AS k, sum(pax)::int AS pax FROM checkin WHERE ${w} AND asal_tipe='wisnus' GROUP BY 1 ORDER BY 2 DESC LIMIT 10`, params),
    q<{ k: string; pax: number }>(`SELECT asal_kab AS k, sum(pax)::int AS pax FROM checkin WHERE ${w} AND asal_tipe='wisnus' AND asal_kab IS NOT NULL GROUP BY 1 ORDER BY 2 DESC LIMIT 10`, params),
    q<{ k: string; pax: number }>(`SELECT asal_negara AS k, sum(pax)::int AS pax FROM checkin WHERE ${w} AND asal_tipe='wisman' GROUP BY 1 ORDER BY 2 DESC LIMIT 10`, params),
    q<{ geo_status: string; n: number; mustahil: number; grup_besar: number; offline: number; dinamis: number }>(`SELECT geo_status, count(*)::int AS n,
        sum(CASE WHEN position('perjalanan_mustahil' in flags) > 0 THEN 1 ELSE 0 END)::int AS mustahil,
        sum(CASE WHEN position('grup_besar' in flags) > 0 THEN 1 ELSE 0 END)::int AS grup_besar,
        sum(CASE WHEN offline THEN 1 ELSE 0 END)::int AS offline,
        sum(CASE WHEN qr_mode='dinamis' THEN 1 ELSE 0 END)::int AS dinamis FROM checkin WHERE ${w} GROUP BY geo_status`, params),
    // Umpan langsung: TANPA identitas pengunjung.
    q<{ jam: string; dtw_kode: string; pax: number; kategori: string; asal_tipe: string; asal_prov: string | null; asal_kab: string | null; asal_negara: string | null; geo_status: string }>(
      `SELECT to_char(visit_at AT TIME ZONE 'Asia/Jakarta', 'HH24:MI') AS jam, dtw_kode, pax, kategori, asal_tipe, asal_prov, asal_kab, asal_negara, geo_status
       FROM checkin WHERE ${w} ORDER BY visit_at DESC LIMIT 20`, params),
    q<{ grup: number; pax: number; anggota: number }>(`SELECT sum(CASE WHEN is_guide THEN 1 ELSE 0 END)::int AS grup, sum(CASE WHEN is_guide THEN pax ELSE 0 END)::int AS pax,
        sum(CASE WHEN linked_group THEN 1 ELSE 0 END)::int AS anggota FROM checkin WHERE ${w}`, params),
  ]);

  // Agregasi wilayah dari referensi DTW (Bakorwil, kab/kota, DPP, KSPP).
  const byKab = new Map<string, Agg>(), byBk = new Map<string, Agg>(), byDpp = new Map<string, Agg>(), byKspp = new Map<string, Agg>();
  const bump = (m: Map<string, Agg>, k: string, r: Agg) => { if (!m.has(k)) m.set(k, empty()); add(m.get(k)!, r); };
  for (const r of byDtw) {
    const d = DTW.get(r.dtw_kode); if (!d) continue;
    const wl = wilayahDtw(d);
    bump(byKab, d.kab, r);
    bump(byBk, wl.bakorwilNama || "—", r);
    bump(byDpp, dppLabel(wl.dpp) || "Di luar DPP", r);
    if (wl.kspp.length) wl.kspp.forEach((k) => bump(byKspp, ksppLabel(k), r)); else bump(byKspp, "Bukan DTWP/KSPP", r);
  }
  const list = (m: Map<string, Agg>) => [...m].map(([k, v]) => ({ k, ...v })).sort((a, b) => b.pax - a.pax);

  // Semua DTW pilot ditampilkan walau belum ada check-in.
  const dtwRows = new Map(byDtw.map((r) => [r.dtw_kode, r]));
  const dtwList = [...new Set([...PILOT.map((p) => p.kode), ...dtwRows.keys()])].filter((k) => !f.dtw || k === f.dtw).map((k) => {
    const d = DTW.get(k)!, r = dtwRows.get(k);
    return { kode: k, nama: d?.nama || k, kab: d?.kab || "", kategori: d?.kategori || "", pax: r?.pax || 0, wisnus: r?.wisnus || 0, wisman: r?.wisman || 0, checkin: r?.checkin || 0, geoOk: r?.geo_ok || 0 };
  }).sort((a, b) => b.pax - a.pax);

  return {
    filter: f,
    totals: tot[0] || { ...empty(), visitors: 0, geo_ok: 0, demo: 0 },
    dtw: dtwList,
    kab: list(byKab), bakorwil: list(byBk), dpp: list(byDpp), kspp: list(byKspp),
    kategori: byKat.sort((a, b) => b.pax - a.pax),
    series: { unit: single ? "jam" : "hari", rows: fillSeries(series, f, single) },
    asal: {
      provinsi: prov.map((r) => ({ k: namaProv(r.k), pax: r.pax })),
      kab: kab.map((r) => ({ k: namaKabAsal(r.k), pax: r.pax })),
      negara: neg.map((r) => ({ k: r.k, pax: r.pax })),
    },
    mutu: mutu,
    rombongan: guide[0] || { grup: 0, pax: 0, anggota: 0 },
    feed: feed.map((r) => ({ jam: r.jam, dtw: DTW.get(r.dtw_kode)?.nama || r.dtw_kode, pax: r.pax, kategori: r.kategori,
      asal: r.asal_tipe === "wisman" ? r.asal_negara : namaKabAsal(r.asal_kab) || namaProv(r.asal_prov), wisman: r.asal_tipe === "wisman", geo: r.geo_status })),
    flows: await getFlows(f),
    cakupan: await getCoverage(f),
    generatedAt: new Date().toISOString(),
  };
}

function fillSeries(rows: (Agg & { k: string })[], f: Filter, single: boolean) {
  const m = new Map(rows.map((r) => [r.k, r]));
  const keys: string[] = [];
  if (single) for (let h = 0; h < 24; h++) keys.push(String(h).padStart(2, "0"));
  else for (let d = f.from; d <= f.to && keys.length < 400; d = addDays(d, 1)) keys.push(d);
  return keys.map((k) => ({ k, wisnus: m.get(k)?.wisnus || 0, wisman: m.get(k)?.wisman || 0 }));
}

/** Pola perjalanan: pasangan DTW berurutan oleh pengunjung yang sama dalam 3 hari. Hanya agregat. */
async function getFlows(f: Filter) {
  const params: unknown[] = [addDays(f.from, -3), f.to, f.from, config.minCell];
  const rows = await q<{ dari: string; ke: string; n: number; jam: number }>(`
    WITH s AS (
      SELECT visitor_hash, dtw_kode, visit_at, visit_date,
             lag(dtw_kode) OVER (PARTITION BY visitor_hash ORDER BY visit_at) AS prev_kode,
             lag(visit_at) OVER (PARTITION BY visitor_hash ORDER BY visit_at) AS prev_at
      FROM checkin WHERE visit_date BETWEEN $1::date AND $2::date AND visitor_hash NOT LIKE 'anon:%')
    SELECT prev_kode AS dari, dtw_kode AS ke, count(*)::int AS n,
           round(avg(extract(epoch FROM visit_at - prev_at) / 3600)::numeric, 1)::float8 AS jam
    FROM s WHERE prev_kode IS NOT NULL AND prev_kode <> dtw_kode AND visit_at - prev_at <= interval '3 days' AND visit_date >= $3::date
    GROUP BY 1, 2 HAVING count(*) >= $4 ORDER BY n DESC LIMIT 15`, params);
  const multi = await q<{ n: number; total: number }>(`
    SELECT count(*) FILTER (WHERE k > 1)::int AS n, count(*)::int AS total FROM (
      SELECT visitor_hash, count(DISTINCT dtw_kode) AS k FROM checkin
      WHERE visit_date BETWEEN $1::date AND $2::date AND visitor_hash NOT LIKE 'anon:%' GROUP BY 1) x`, [f.from, f.to]);
  return {
    pasangan: rows.map((r) => ({ dari: DTW.get(r.dari)?.nama || r.dari, ke: DTW.get(r.ke)?.nama || r.ke, n: r.n, jam: r.jam })),
    multiDtw: multi[0]?.n || 0, pengunjung: multi[0]?.total || 0, minCell: config.minCell,
  };
}

/** Cakupan scan dibanding laporan manual kab/kota, per bulan dari tanggal akhir filter. */
async function getCoverage(f: Filter) {
  const bulan = f.to.slice(0, 7);
  const scan = await q<{ dtw_kode: string; wisnus: number; wisman: number }>(`
    SELECT dtw_kode, sum(CASE WHEN asal_tipe='wisnus' THEN pax ELSE 0 END)::int AS wisnus, sum(CASE WHEN asal_tipe='wisman' THEN pax ELSE 0 END)::int AS wisman
    FROM checkin WHERE to_char(visit_date, 'YYYY-MM') = $1 GROUP BY 1`, [bulan]);
  const man = await q<{ dtw_kode: string; wisnus: number; wisman: number; sumber: string | null }>(`SELECT dtw_kode, wisnus, wisman, sumber FROM laporan_manual WHERE bulan = $1`, [bulan]);
  const sm = new Map(scan.map((r) => [r.dtw_kode, r])), mm = new Map(man.map((r) => [r.dtw_kode, r]));
  const kodes = [...new Set([...PILOT.map((p) => p.kode), ...sm.keys()])].filter((k) => !f.dtw || k === f.dtw);
  return {
    bulan,
    rows: kodes.map((k) => {
      const s = sm.get(k), m = mm.get(k);
      const sc = (s?.wisnus || 0) + (s?.wisman || 0), mn = m ? m.wisnus + m.wisman : null;
      return { kode: k, nama: DTW.get(k)?.nama || k, scan: sc, manual: mn, persen: mn ? Math.round((sc / mn) * 1000) / 10 : null, sumber: m?.sumber || null };
    }).sort((a, b) => (b.persen ?? -1) - (a.persen ?? -1)),
  };
}
