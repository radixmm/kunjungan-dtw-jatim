"use client";
import { useCallback, useEffect, useMemo, useState } from "react";

type Agg = { k: string; pax: number; wisnus: number; wisman: number; checkin: number };
type Stats = {
  filter: { from: string; to: string; mutu: string; dtw?: string };
  totals: { pax: number; wisnus: number; wisman: number; checkin: number; visitors: number; geo_ok: number; demo: number };
  dtw: { kode: string; nama: string; kab: string; kategori: string; pax: number; wisnus: number; wisman: number; checkin: number; geoOk: number }[];
  kab: Agg[]; bakorwil: Agg[]; dpp: Agg[]; kspp: Agg[];
  kategori: (Agg & { kategori: string })[];
  series: { unit: "jam" | "hari"; rows: { k: string; wisnus: number; wisman: number }[] };
  asal: { provinsi: { k: string; pax: number }[]; kab: { k: string; pax: number }[]; negara: { k: string; pax: number }[] };
  mutu: { geo_status: string; n: number; mustahil: number; grup_besar: number; offline: number; dinamis: number }[];
  rombongan: { grup: number; pax: number; anggota: number };
  feed: { jam: string; dtw: string; pax: number; kategori: string; asal: string | null; wisman: boolean; geo: string }[];
  flows: { pasangan: { dari: string; ke: string; n: number; jam: number }[]; multiDtw: number; pengunjung: number; minCell: number };
  cakupan: { bulan: string; rows: { kode: string; nama: string; scan: number; manual: number | null; persen: number | null; sumber: string | null }[] };
  generatedAt: string;
};

const KAT: Record<string, string> = { keluarga: "Keluarga", travel_agent: "Travel agent", rombongan_pribadi: "Rombongan pribadi", sendiri: "Sendiri" };
const GEO: Record<string, string> = { ok: "Lokasi cocok", jauh: "Di luar radius", ditolak: "Izin lokasi ditolak", tidak_ada: "Tanpa lokasi" };
const nf = new Intl.NumberFormat("id-ID");
const n = (x: number) => nf.format(x || 0);
const countryName = (() => { const dn = new Intl.DisplayNames(["id"], { type: "region" }); return (c: string | null) => (c ? dn.of(c) || c : "—"); })();
const addDays = (d: string, k: number) => { const x = new Date(d + "T00:00:00Z"); x.setUTCDate(x.getUTCDate() + k); return x.toISOString().slice(0, 10); };

type Range = "hari" | "7" | "30" | "bulan" | "kustom";

export default function Dashboard({ demo, pilot, today, email }: { demo: boolean; pilot: { kode: string; nama: string }[]; today: string; email: string }) {
  const [range, setRange] = useState<Range>("hari");
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [dtw, setDtw] = useState("");
  const [mutu, setMutu] = useState<"semua" | "terverifikasi">("semua");
  const [data, setData] = useState<Stats | null>(null);
  const [err, setErr] = useState("");
  const [wil, setWil] = useState<"kab" | "bakorwil" | "dpp" | "kspp">("kab");
  const [asal, setAsal] = useState<"provinsi" | "kab" | "negara">("provinsi");
  const [seeding, setSeeding] = useState(false);

  useEffect(() => {
    if (range === "hari") { setFrom(today); setTo(today); }
    if (range === "7") { setFrom(addDays(today, -6)); setTo(today); }
    if (range === "30") { setFrom(addDays(today, -29)); setTo(today); }
    if (range === "bulan") { setFrom(today.slice(0, 8) + "01"); setTo(today); }
  }, [range, today]);

  const qs = useMemo(() => new URLSearchParams({ from, to, mutu, ...(dtw ? { dtw } : {}) }).toString(), [from, to, mutu, dtw]);
  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/stats?" + qs, { cache: "no-store" });
      if (r.status === 401) { location.reload(); return; }
      setData(await r.json()); setErr("");
    } catch { setErr("Gagal memuat data, mencoba lagi…"); }
  }, [qs]);
  // Real-time: muat ulang tiap 10 detik selama tab terlihat.
  useEffect(() => {
    load();
    const id = setInterval(() => { if (document.visibilityState === "visible") load(); }, 10000);
    return () => clearInterval(id);
  }, [load]);

  const seed = async () => { setSeeding(true); await fetch("/api/demo/seed", { method: "POST" }); setSeeding(false); setRange("30"); load(); };
  const logout = async () => { await fetch("/api/admin/logout", { method: "POST" }); location.reload(); };

  const t = data?.totals;
  const geoPct = t && t.checkin ? Math.round((t.geo_ok / t.checkin) * 100) : 0;
  const wilRows = data ? data[wil] : [];
  const asalRows = data ? (asal === "negara" ? data.asal.negara.map((r) => ({ k: countryName(r.k), pax: r.pax })) : data.asal[asal]) : [];

  return (
    <main className="db">
      <div className="db-top">
        <div>
          <h1>Kunjungan Wisatawan DTW — Pilot Scan QR</h1>
          <p>Bidang Destinasi Pariwisata · Disbudpar Provinsi Jawa Timur · {pilot.length} DTW pilot</p>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <span className="live"><i />{data ? `Diperbarui ${new Date(data.generatedAt).toLocaleTimeString("id-ID", { timeZone: "Asia/Jakarta" })} WIB` : "Memuat…"}</span>
          <a className="btn" href="/qr" style={{ minHeight: 36 }}>QR DTW</a>
          {!demo && <button className="btn" style={{ minHeight: 36 }} onClick={logout} title={email}>Keluar</button>}
        </div>
      </div>

      {demo && (
        <div className="demo-flag" style={{ display: "flex", gap: 12, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
          <span>MODE DEMO — dashboard terbuka tanpa login. Data bertanda demo adalah simulasi, bukan kunjungan nyata.</span>
          <button className="btn" style={{ minHeight: 32 }} onClick={seed} disabled={seeding}>{seeding ? "Mengisi…" : "Isi data simulasi"}</button>
        </div>
      )}

      <div className="filters">
        <div className="seg" role="group" aria-label="Rentang waktu">
          {([["hari", "Hari ini"], ["7", "7 hari"], ["30", "30 hari"], ["bulan", "Bulan ini"], ["kustom", "Pilih tanggal"]] as [Range, string][]).map(([k, l]) => (
            <button key={k} aria-pressed={range === k} onClick={() => setRange(k)}>{l}</button>
          ))}
        </div>
        {range === "kustom" && (<>
          <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} aria-label="Dari tanggal" />
          <input type="date" value={to} min={from} max={today} onChange={(e) => setTo(e.target.value)} aria-label="Sampai tanggal" />
        </>)}
        <select value={dtw} onChange={(e) => setDtw(e.target.value)} aria-label="DTW">
          <option value="">Semua DTW pilot</option>
          {pilot.map((p) => <option key={p.kode} value={p.kode}>{p.nama}</option>)}
        </select>
        <div className="seg" role="group" aria-label="Mutu data">
          <button aria-pressed={mutu === "semua"} onClick={() => setMutu("semua")}>Semua</button>
          <button aria-pressed={mutu === "terverifikasi"} onClick={() => setMutu("terverifikasi")} title="Lokasi cocok dan tanpa bendera perjalanan mustahil">Terverifikasi lokasi</button>
        </div>
        <span className="sp" />
        <ExportButtons month={to.slice(0, 7)} mutu={mutu} />
      </div>
      {err && <div className="alert bad">{err}</div>}

      <section className="kpis" aria-label="Ringkasan">
        <Kpi label="Wisatawan (orang)" value={t?.pax} note={`${n(t?.checkin || 0)} check-in`} />
        <Kpi label="Wisnus" value={t?.wisnus} note={t?.pax ? `${Math.round((t.wisnus / t.pax) * 100)}%` : ""} dot="var(--wisnus)" />
        <Kpi label="Wisman" value={t?.wisman} note={t?.pax ? `${Math.round((t.wisman / t.pax) * 100)}%` : ""} dot="var(--wisman)" />
        <Kpi label="Akun unik" value={t?.visitors} note="1 akun = 1× per DTW per hari" />
        <Kpi label="Lokasi terverifikasi" value={geoPct} suffix="%" note="dari seluruh check-in" />
        <Kpi label="Rombongan travel agent" value={data?.rombongan.grup} note={`${n(data?.rombongan.pax || 0)} orang via pemandu`} />
      </section>

      <div className="grid">
        <section className="panel w8">
          <h2>{data?.series.unit === "jam" ? "Kunjungan per jam (WIB)" : "Kunjungan per hari"}</h2>
          <div className="legend"><span><i style={{ background: "var(--wisnus)" }} />Wisnus</span><span><i style={{ background: "var(--wisman)" }} />Wisman</span></div>
          {data && <Columns rows={data.series.rows} unit={data.series.unit} />}
        </section>
        <section className="panel w4">
          <h2>Kategori rombongan</h2>
          <Bars rows={(data?.kategori || []).map((r) => ({ k: KAT[r.kategori] || r.kategori, a: r.wisnus, b: r.wisman }))} stacked />
          <p className="sub" style={{ margin: 0 }}>{n(data?.rombongan.anggota || 0)} anggota rombongan check-in sendiri dan tidak dihitung ulang.</p>
        </section>

        <section className="panel w12">
          <h2>Per DTW</h2>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead><tr><th>Kode</th><th>DTW</th><th>Kab/Kota</th><th>Kategori</th><th className="r">Wisnus</th><th className="r">Wisman</th><th className="r">Total</th><th className="r">Check-in</th><th className="r">Lokasi cocok</th></tr></thead>
              <tbody>
                {data?.dtw.map((r) => (
                  <tr key={r.kode}>
                    <td className="muted">{r.kode}</td><td><b>{r.nama}</b></td><td>{r.kab}</td><td>{r.kategori}</td>
                    <td className="r">{n(r.wisnus)}</td><td className="r">{n(r.wisman)}</td><td className="r"><b>{n(r.pax)}</b></td><td className="r">{n(r.checkin)}</td>
                    <td className="r">{r.checkin ? <Pct v={Math.round((r.geoOk / r.checkin) * 100)} /> : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel">
          <h2>Per wilayah</h2>
          <div className="seg" role="group" aria-label="Pengelompokan wilayah" style={{ alignSelf: "flex-start" }}>
            {([["kab", "Kab/Kota"], ["bakorwil", "Bakorwil"], ["dpp", "DPP"], ["kspp", "KSPP"]] as const).map(([k, l]) => <button key={k} aria-pressed={wil === k} onClick={() => setWil(k)}>{l}</button>)}
          </div>
          <Bars rows={wilRows.map((r) => ({ k: r.k, a: r.wisnus, b: r.wisman }))} stacked />
          <p className="sub" style={{ margin: 0 }}>DPP dan KSPP sesuai Perda Provinsi Jawa Timur No. 6 Tahun 2017 (RIPPARPROV).</p>
        </section>
        <section className="panel">
          <h2>Asal wisatawan</h2>
          <div className="seg" role="group" aria-label="Asal" style={{ alignSelf: "flex-start" }}>
            {([["provinsi", "Provinsi"], ["kab", "Kab/Kota"], ["negara", "Negara (wisman)"]] as const).map(([k, l]) => <button key={k} aria-pressed={asal === k} onClick={() => setAsal(k)}>{l}</button>)}
          </div>
          <Bars rows={asalRows.map((r) => ({ k: r.k, a: asal === "negara" ? 0 : r.pax, b: asal === "negara" ? r.pax : 0 }))} stacked />
        </section>

        <section className="panel w8">
          <h2>Pola perjalanan antar-DTW</h2>
          <p className="sub">Pasangan DTW yang dikunjungi berurutan oleh akun yang sama dalam 3 hari. Agregat; sel di bawah {data?.flows.minCell ?? 1} disembunyikan.</p>
          {data && data.flows.pasangan.length ? (
            <div className="tbl-wrap"><table className="tbl">
              <thead><tr><th>Dari</th><th></th><th>Ke</th><th className="r">Akun</th><th className="r">Jeda rata-rata</th></tr></thead>
              <tbody>{data.flows.pasangan.map((f, i) => (
                <tr key={i}><td>{f.dari}</td><td className="muted">→</td><td>{f.ke}</td><td className="r"><b>{n(f.n)}</b></td><td className="r">{f.jam < 24 ? `${f.jam} jam` : `${Math.round(f.jam / 24 * 10) / 10} hari`}</td></tr>
              ))}</tbody>
            </table></div>
          ) : <p className="empty">Belum ada akun yang mengunjungi lebih dari satu DTW pilot pada rentang ini.</p>}
          {data && data.flows.pengunjung > 0 && <p className="sub" style={{ margin: 0 }}>{n(data.flows.multiDtw)} dari {n(data.flows.pengunjung)} akun ({Math.round((data.flows.multiDtw / data.flows.pengunjung) * 100)}%) mengunjungi lebih dari satu DTW pilot.</p>}
        </section>
        <section className="panel w4">
          <h2>Mutu data</h2>
          <Bars rows={(data?.mutu || []).map((r) => ({ k: GEO[r.geo_status] || r.geo_status, a: r.n, b: 0 }))} single />
          <ul className="small" style={{ margin: 0, paddingLeft: 18 }}>
            <li>{n(sum(data?.mutu, "mustahil"))} bendera perjalanan mustahil (&gt;150 km/jam)</li>
            <li>{n(sum(data?.mutu, "grup_besar"))} grup &gt;30 orang tanpa pemandu</li>
            <li>{n(sum(data?.mutu, "offline"))} terkirim dari antrean offline</li>
            <li>{n(sum(data?.mutu, "dinamis"))} lewat QR dinamis (tablet loket)</li>
          </ul>
        </section>

        <section className="panel w8">
          <h2>Cakupan scan dibanding laporan manual kab/kota · {data?.cakupan.bulan}</h2>
          <p className="sub">Jumlah orang tercatat lewat scan QR dibagi laporan manual bulan yang sama. Laporan manual diimpor dari sheet DATABASE.</p>
          <div className="tbl-wrap"><table className="tbl">
            <thead><tr><th>DTW</th><th className="r">Scan QR</th><th className="r">Laporan manual</th><th className="r">Cakupan</th><th>Sumber pembanding</th></tr></thead>
            <tbody>{data?.cakupan.rows.map((r) => (
              <tr key={r.kode}><td>{r.nama}</td><td className="r">{n(r.scan)}</td><td className="r">{r.manual == null ? "—" : n(r.manual)}</td>
                <td className="r">{r.persen == null ? <span className="muted">belum ada laporan</span> : <b>{r.persen.toLocaleString("id-ID")}%</b>}</td><td className="muted small">{r.sumber || ""}</td></tr>
            ))}</tbody>
          </table></div>
        </section>
        <section className="panel w4">
          <h2>Check-in terbaru</h2>
          <div className="feed" aria-live="polite">
            {data?.feed.length ? data.feed.map((f, i) => (
              <div key={i}><span className="muted tnum">{f.jam}</span><span><b>{f.dtw}</b><br /><span className="muted small">{KAT[f.kategori]} · {f.wisman ? countryName(f.asal) : f.asal}</span></span><span className="tnum">{f.pax} org</span></div>
            )) : <p className="empty">Belum ada check-in.</p>}
          </div>
        </section>
      </div>
      <p className="small muted">Email pengunjung tidak disimpan dan tidak ditampilkan; seluruh angka di halaman ini agregat. Penghitungan: satu akun Google dihitung sekali per DTW per hari (WIB); jumlah orang = jumlah anggota grup yang diisi.</p>
    </main>
  );
}

const sum = (rows: Stats["mutu"] | undefined, k: "mustahil" | "grup_besar" | "offline" | "dinamis") => (rows || []).reduce((a, r) => a + (r[k] || 0), 0);

function Kpi({ label, value, note, suffix, dot }: { label: string; value?: number; note?: string; suffix?: string; dot?: string }) {
  return (
    <div className="kpi">
      <span>{dot && <i style={{ display: "inline-block", width: 9, height: 9, borderRadius: 3, background: dot, marginRight: 6 }} />}{label}</span>
      <b>{value == null ? "—" : n(value)}{suffix}</b>
      {note && <small>{note}</small>}
    </div>
  );
}

function Pct({ v }: { v: number }) {
  return <span className={"pill " + (v >= 70 ? "ok" : v >= 40 ? "warn" : "bad")}>{v}%</span>;
}

// Batang horizontal; bertumpuk wisnus (a) + wisman (b).
function Bars({ rows, stacked, single }: { rows: { k: string; a: number; b: number }[]; stacked?: boolean; single?: boolean }) {
  const max = Math.max(1, ...rows.map((r) => r.a + r.b));
  if (!rows.length) return <p className="empty">Belum ada data.</p>;
  return (
    <div className="bars">
      {rows.slice(0, 12).map((r) => (
        <div className="bar" key={r.k} title={stacked ? `${r.k}: ${n(r.a)} wisnus, ${n(r.b)} wisman` : `${r.k}: ${n(r.a)}`}>
          <span className="lab">{r.k}</span>
          <span className="track">
            {r.a > 0 && <span style={{ width: `${(r.a / max) * 100}%`, background: single ? "var(--accent)" : "var(--wisnus)" }} />}
            {r.b > 0 && <span style={{ width: `${(r.b / max) * 100}%`, background: "var(--wisman)" }} />}
          </span>
          <span className="val">{n(r.a + r.b)}</span>
        </div>
      ))}
    </div>
  );
}

// Kolom bertumpuk per jam/hari dengan tooltip.
function Columns({ rows, unit }: { rows: { k: string; wisnus: number; wisman: number }[]; unit: "jam" | "hari" }) {
  const [tip, setTip] = useState<{ x: number; y: number; r: (typeof rows)[number] } | null>(null);
  const W = 720, H = 200, pl = 36, pb = 22, pt = 8;
  const max = Math.max(1, ...rows.map((r) => r.wisnus + r.wisman));
  const nice = niceMax(max);
  const bw = (W - pl) / rows.length;
  const y = (v: number) => H - pb - (v / nice) * (H - pb - pt);
  const every = Math.ceil(rows.length / 12);
  const lab = (k: string) => (unit === "jam" ? k : `${Number(k.slice(8))}/${Number(k.slice(5, 7))}`);
  return (
    <div style={{ position: "relative" }} onMouseLeave={() => setTip(null)}>
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label="Grafik kunjungan">
        {[0, 0.5, 1].map((f) => (<g key={f}><line className="grid-line" x1={pl} x2={W} y1={y(nice * f)} y2={y(nice * f)} /><text x={pl - 6} y={y(nice * f) + 4} textAnchor="end">{n(nice * f)}</text></g>))}
        {rows.map((r, i) => {
          const x = pl + i * bw + Math.max(1, bw * 0.15), w = Math.max(2, bw * 0.7);
          const h1 = y(0) - y(r.wisnus), h2 = y(0) - y(r.wisman);
          return (
            <g key={r.k} onMouseMove={(e) => setTip({ x: e.clientX, y: e.clientY, r })}>
              <rect x={pl + i * bw} y={pt} width={bw} height={H - pb - pt} fill="transparent" />
              {r.wisnus > 0 && <rect x={x} y={y(r.wisnus)} width={w} height={h1} fill="var(--wisnus)" />}
              {r.wisman > 0 && <rect x={x} y={y(r.wisnus) - h2 - (r.wisnus > 0 ? 2 : 0)} width={w} height={h2} fill="var(--wisman)" rx={Math.min(4, w / 2)} />}
              {i % every === 0 && <text x={pl + i * bw + bw / 2} y={H - 6} textAnchor="middle">{lab(r.k)}</text>}
            </g>
          );
        })}
      </svg>
      {tip && <div className="tip" style={{ left: tip.x + 12, top: tip.y - 10 }}><b>{unit === "jam" ? `Pukul ${tip.r.k}.00` : tip.r.k}</b><br />Wisnus {n(tip.r.wisnus)} · Wisman {n(tip.r.wisman)}</div>}
    </div>
  );
}
function niceMax(v: number) { const p = 10 ** Math.floor(Math.log10(v)); const m = v / p; return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p; }

function ExportButtons({ month, mutu }: { month: string; mutu: string }) {
  const [m, setM] = useState(month);
  useEffect(() => setM(month), [month]);
  return (
    <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
      <input type="month" value={m} onChange={(e) => setM(e.target.value)} aria-label="Bulan rekap" />
      <a className="btn" style={{ minHeight: 38 }} href={`/api/export?bulan=${m}&format=xlsx&mutu=${mutu}`}>Ekspor rekap (.xlsx)</a>
      <a className="btn" style={{ minHeight: 38 }} href={`/api/export?bulan=${m}&format=csv&mutu=${mutu}`}>.csv</a>
    </span>
  );
}
