import { NextResponse } from "next/server";
import { isDemo } from "@/lib/config";
import { q } from "@/lib/db";
import { DTW, PILOT, WILAYAH } from "@/lib/ref";
import { visitorHash } from "@/lib/crypto";
import { wibDate, addDays, wibMonth } from "@/lib/time";

// Mengisi data simulasi (ditandai demo=true) agar dashboard bisa dicoba. Hanya aktif di MODE DEMO.
export async function POST() {
  if (!isDemo()) return NextResponse.json({ error: "hanya_mode_demo" }, { status: 403 });
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const pick = <T,>(a: T[], w?: number[]) => {
    if (!w) return a[Math.floor(rnd() * a.length)];
    let r = rnd() * w.reduce((x, y) => x + y, 0);
    for (let i = 0; i < a.length; i++) { r -= w[i]; if (r <= 0) return a[i]; }
    return a[a.length - 1];
  };
  const pilot = PILOT.map((p) => DTW.get(p.kode)!).filter(Boolean);
  const weight = pilot.map((d) => Math.sqrt((d.v26?.[0] || d.v25?.[0] || 1000) + 20 * (d.v26?.[1] || d.v25?.[1] || 0)));
  const wismanShare = pilot.map((d) => { const a = d.v25 || [1, 0]; return Math.min(0.45, a[1] / Math.max(1, a[0] + a[1]) * 3); });
  const jatim = WILAYAH.provinsi.find((p) => p.kode === "35")!;
  const provW = WILAYAH.provinsi.map((p) => (p.kode === "35" ? 60 : ["31", "32", "33", "34", "36", "51"].includes(p.kode) ? 6 : 0.6));
  const negara = ["MY", "SG", "NL", "FR", "DE", "CN", "AU", "JP", "US", "GB"];
  const today = wibDate();
  const rows: unknown[][] = [];
  const nVisitors = 900;
  for (let v = 0; v < nVisitors; v++) {
    const vh = visitorHash(`pengunjung${v}@demo.local`);
    const nTrips = rnd() < 0.18 ? 2 + Math.floor(rnd() * 2) : 1;
    let day = addDays(today, -Math.floor(rnd() * 30));
    let di = pilot.indexOf(pick(pilot, weight));
    const isWisman = rnd() < wismanShare[di];
    const kat = pick(["keluarga", "rombongan_pribadi", "travel_agent", "sendiri"], [45, 25, 12, 18]);
    const pax = kat === "sendiri" ? 1 : kat === "travel_agent" ? 8 + Math.floor(rnd() * 30) : kat === "keluarga" ? 2 + Math.floor(rnd() * 5) : 3 + Math.floor(rnd() * 10);
    const prov = isWisman ? null : pick(WILAYAH.provinsi, provW);
    const kab = prov ? pick(prov === jatim ? jatim.kab : prov.kab)[0] : null;
    let hour = 7 + Math.floor(rnd() * 9);
    for (let t = 0; t < nTrips; t++) {
      if (t > 0) { // perjalanan lanjutan: DTW lain, beberapa jam atau sehari kemudian
        const others = pilot.map((_, i) => i).filter((i) => i !== di);
        di = pick(others, others.map((i) => weight[i]));
        hour += 3 + Math.floor(rnd() * 4);
        if (hour > 17) { day = addDays(day, 1); hour = 8 + Math.floor(rnd() * 3); }
        if (day > today) break;
      }
      const d = pilot[di];
      const at = new Date(`${day}T${String(hour).padStart(2, "0")}:${String(Math.floor(rnd() * 60)).padStart(2, "0")}:00+07:00`);
      if (at.getTime() > Date.now()) continue;
      const geo = pick(["ok", "jauh", "ditolak", "tidak_ada"], [72, 6, 14, 8]);
      const guide = kat === "travel_agent" && rnd() < 0.7;
      rows.push([at.toISOString(), day, d.id, vh, pax, kat, guide, false, isWisman ? "wisman" : "wisnus", prov?.kode || null, kab, isWisman ? pick(negara) : null,
        isWisman ? "en" : "id", pick(["statis", "dinamis"], [80, 20]), geo, geo === "ok" ? Math.floor(rnd() * 800) : geo === "jauh" ? 20000 + Math.floor(rnd() * 90000) : null, pax > 30 && !guide ? "grup_besar" : ""]);
    }
  }
  await q(`DELETE FROM checkin WHERE demo`);
  for (const r of rows) {
    await q(`INSERT INTO checkin (visit_at, visit_date, dtw_kode, visitor_hash, pax, kategori, is_guide, linked_group, asal_tipe, asal_prov, asal_kab, asal_negara, lang, qr_mode, geo_status, geo_dist_m, flags, consent_ver, demo)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,'demo',true) ON CONFLICT DO NOTHING`, r);
  }
  // Laporan manual pembanding: rata-rata bulanan 2026 dari sheet DATABASE (v26 = [wisnus, wisman, bulan terlapor]).
  const bulan = wibMonth();
  for (const d of pilot) {
    const v = d.v26; if (!v || !v[2]) continue;
    await q(`INSERT INTO laporan_manual (bulan, dtw_kode, wisnus, wisman, sumber) VALUES ($1,$2,$3,$4,$5)
      ON CONFLICT (bulan, dtw_kode) DO UPDATE SET wisnus = EXCLUDED.wisnus, wisman = EXCLUDED.wisman, sumber = EXCLUDED.sumber`,
      [bulan, d.id, Math.round(v[0] / v[2]), Math.round(v[1] / v[2]), `rata-rata bulanan 2026 (${v[2]} bulan terlapor)`]);
  }
  // Rekap harian simulasi untuk DTW jalur petugas & online, plus contoh periode libur.
  await q(`DELETE FROM rekap_harian WHERE diisi_oleh LIKE 'demo%' OR sumber = 'scan'`);
  await q(`DELETE FROM hitung_petugas WHERE petugas LIKE 'demo%'`);
  await q(`DELETE FROM periode_libur WHERE dibuat_oleh = 'demo'`);
  await q(`INSERT INTO periode_libur (nama, mulai, selesai, dibuat_oleh) VALUES ($1, $2, $3, 'demo'), ('Libur Natal & Tahun Baru (contoh)', $4, $5, 'demo')`,
    ["Libur panjang akhir pekan (contoh)", addDays(today, -9), addDays(today, -7), today.slice(0, 4) + "-12-20", String(Number(today.slice(0, 4)) + 1) + "-01-04"]);
  const all = PILOT.map((p) => DTW.get(p.kode)!).filter(Boolean);
  for (const d of all) {
    const p = PILOT.find((x) => x.kode === d.id)!;
    if (p.jalur === "scan") continue;
    const base = Math.max(300, Math.round(((d.v26?.[0] || d.v25?.[0] || 30000) + (d.v26?.[1] || d.v25?.[1] || 0)) / Math.max(1, d.v26?.[2] || 12) / 30));
    const wmShare = Math.max(0.03, Math.min(0.4, (d.v25?.[1] || 0) / Math.max(1, (d.v25?.[0] || 0) + (d.v25?.[1] || 0))));
    for (let i = 1; i <= 30; i++) {
      const day = addDays(today, -i);
      if (p.jalur === "petugas" && (i === 2 || i === 3) && d.id.endsWith("8")) continue; // contoh rekap belum diisi
      const dow = new Date(day + "T00:00:00Z").getUTCDay();
      const tot = Math.round(base * (dow === 0 || dow === 6 ? 1.8 : 0.8) * (0.8 + rnd() * 0.4));
      const wm = Math.round(tot * wmShare);
      const status = p.jalur === "online" ? "terverifikasi" : i > 8 ? "terverifikasi" : i === 5 && d.id.endsWith("7") ? "ditolak" : "diajukan";
      await q(`INSERT INTO rekap_harian (dtw_kode, tanggal, wisnus, wisman, sumber, catatan, diisi_oleh, diisi_at, status, diverifikasi_oleh, diverifikasi_at, catatan_verifikasi)
        VALUES ($1, $2, $3, $4, $5, $6, $7, now(), $8, $9, CASE WHEN $9::text IS NULL THEN NULL ELSE now() END, $10) ON CONFLICT DO NOTHING`,
        [d.id, day, tot - wm, wm, p.jalur, i === 7 ? "Hujan deras sore hari" : null, p.jalur === "online" ? "demo-unggah" : "demo-petugas@contoh.id", status,
          status === "terverifikasi" ? (p.jalur === "online" ? "Balai Besar TNBTS (contoh)" : "demo-verifikator@contoh.id") : status === "ditolak" ? "demo-verifikator@contoh.id" : null,
          status === "ditolak" ? "Angka wisman tidak wajar, mohon dicek ulang" : null]);
    }
    if (p.jalur === "petugas") {
      for (let h = 0; h < 40; h++) {
        const at = new Date(`${today}T${String(8 + Math.floor(h / 6)).padStart(2, "0")}:${String((h * 7) % 60).padStart(2, "0")}:00+07:00`);
        if (at.getTime() > Date.now()) break;
        const wm = rnd() < wmShare ? 1 : 0;
        await q(`INSERT INTO hitung_petugas (client_id, dtw_kode, waktu, tanggal, wisnus, wisman, petugas) VALUES ($1, $2, $3, $4, $5, $6, 'demo-petugas') ON CONFLICT DO NOTHING`,
          [`demo-${d.id}-${h}`, d.id, at.toISOString(), today, wm ? 0 : 1 + Math.floor(rnd() * 4), wm]);
      }
    }
  }
  return NextResponse.json({ ok: true, checkin: rows.length });
}
