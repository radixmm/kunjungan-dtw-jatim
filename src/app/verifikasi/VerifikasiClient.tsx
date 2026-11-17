"use client";
import { useCallback, useEffect, useMemo, useState } from "react";

type Row = { dtw_kode: string; tanggal: string; wisnus: number; wisman: number; sumber: string; catatan: string | null; diisi_oleh: string | null; status: "diajukan" | "terverifikasi" | "ditolak"; diverifikasi_oleh: string | null; catatan_verifikasi: string | null };
type Data = {
  start: string; end: string; today: string; days: { tanggal: string; libur: boolean; lewat: boolean }[]; libur: { nama: string; mulai: string; selesai: string }[];
  dtw: { kode: string; nama: string; kab: string; jalur: "petugas" | "scan" | "online"; bisaVerifikasi: boolean }[];
  rows: Row[]; tunggakan: { dtw: string; tanggal: string; jenis: "belum_diisi" | "terlambat_verifikasi" }[];
};
const nf = new Intl.NumberFormat("id-ID");
const JALUR: Record<string, string> = { petugas: "Rekap petugas", scan: "Scan wisatawan", online: "Tiket online" };
const STATUS: Record<string, string> = { diajukan: "Menunggu", terverifikasi: "Terverifikasi", ditolak: "Ditolak" };
const addDays = (d: string, k: number) => { const x = new Date(d + "T00:00:00Z"); x.setUTCDate(x.getUTCDate() + k); return x.toISOString().slice(0, 10); };
const fmt = (s: string, o: Intl.DateTimeFormatOptions) => new Date(s + "T00:00:00").toLocaleDateString("id-ID", o);

export default function VerifikasiClient({ isAdmin, wilayah }: { isAdmin: boolean; wilayah: string }) {
  const [minggu, setMinggu] = useState("");
  const [data, setData] = useState<Data | null>(null);
  const [open, setOpen] = useState<{ dtw: string; tanggal: string } | null>(null);
  const [alasan, setAlasan] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch("/api/verifikasi" + (minggu ? `?minggu=${minggu}` : ""), { cache: "no-store" });
    if (r.status === 401) { location.reload(); return; }
    setData(await r.json());
  }, [minggu]);
  useEffect(() => { load(); }, [load]);

  const rmap = useMemo(() => new Map((data?.rows || []).map((r) => [r.dtw_kode + r.tanggal, r])), [data]);
  const act = async (aksi: "setujui" | "tolak" | "buka", items: { dtw: string; tanggal: string }[], catatan?: string) => {
    setBusy(true);
    await fetch("/api/verifikasi", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ aksi, items, catatan }) });
    setBusy(false); setOpen(null); setAlasan(""); load();
  };
  const menunggu = (data?.rows || []).filter((r) => r.status === "diajukan" && data?.dtw.find((d) => d.kode === r.dtw_kode)?.bisaVerifikasi);
  const cur = open ? rmap.get(open.dtw + open.tanggal) : null;
  const curDtw = open ? data?.dtw.find((d) => d.kode === open.dtw) : null;
  const nama = (k: string) => data?.dtw.find((d) => d.kode === k)?.nama || k;
  const liburMinggu = data?.libur.filter((l) => l.selesai >= data.start && l.mulai <= data.end) || [];
  const tBelum = data?.tunggakan.filter((t) => t.jenis === "belum_diisi") || [];
  const tTelat = data?.tunggakan.filter((t) => t.jenis === "terlambat_verifikasi") || [];

  return (
    <main className="db">
      <div className="db-top">
        <div>
          <h1>Verifikasi rekap DTW</h1>
          <p>{wilayah} · Verifikasi mingguan; pada periode libur wajib harian (paling lambat H+1).</p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button className="btn" onClick={() => setMinggu(addDays(data?.start || "", -7))} disabled={!data}>‹ Pekan lalu</button>
          <b className="tnum">{data ? `${fmt(data.start, { day: "numeric", month: "short" })} – ${fmt(data.end, { day: "numeric", month: "short", year: "numeric" })}` : "…"}</b>
          <button className="btn" onClick={() => setMinggu(addDays(data?.start || "", 7))} disabled={!data || data.end >= data.today}>Pekan depan ›</button>
        </div>
      </div>

      {(tBelum.length > 0 || tTelat.length > 0) && (
        <section className="panel w12" style={{ gridColumn: "auto" }}>
          <h2>Perlu tindakan</h2>
          <div className="small" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {tTelat.length > 0 && <div><span className="st-pill st-ditolak">{tTelat.length} terlambat diverifikasi</span> {summarize(tTelat, nama)}</div>}
            {tBelum.length > 0 && <div><span className="st-pill st-diajukan">{tBelum.length} rekap belum diisi petugas</span> {summarize(tBelum, nama)}</div>}
          </div>
        </section>
      )}
      {liburMinggu.length > 0 && <div className="alert warn">Periode libur pekan ini: {liburMinggu.map((l) => `${l.nama} (${fmt(l.mulai, { day: "numeric", month: "short" })}–${fmt(l.selesai, { day: "numeric", month: "short" })})`).join("; ")}. Kolom berwarna kuning wajib diverifikasi setiap hari.</div>}

      <section className="panel w12" style={{ gridColumn: "auto" }}>
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" }}>
          <h2 style={{ flex: "none" }}>Rekap per hari</h2>
          <button className="btn primary" style={{ flex: "none", minHeight: 38 }} disabled={!menunggu.length || busy}
            onClick={() => act("setujui", menunggu.map((r) => ({ dtw: r.dtw_kode, tanggal: r.tanggal })))}>Setujui semua yang menunggu ({menunggu.length})</button>
        </div>
        <div className="tbl-wrap">
          <table className="tbl vgrid">
            <thead><tr><th>DTW</th><th>Jalur</th>{data?.days.map((d) => <th key={d.tanggal} className={"r" + (d.libur ? " libur" : "")}>{fmt(d.tanggal, { weekday: "short", day: "numeric" })}{d.libur ? " ★" : ""}</th>)}<th className="r">Total pekan</th></tr></thead>
            <tbody>
              {data?.dtw.map((d) => {
                let tw = 0;
                return (
                  <tr key={d.kode}>
                    <td><b>{d.nama}</b><br /><span className="muted small">{d.kab}</span></td>
                    <td className="small">{JALUR[d.jalur]}</td>
                    {data.days.map((day) => {
                      const r = rmap.get(d.kode + day.tanggal);
                      if (r) tw += r.wisnus + r.wisman;
                      return (
                        <td key={day.tanggal} className={"cell" + (day.libur ? " libur" : "") + (open?.dtw === d.kode && open.tanggal === day.tanggal ? " sel" : "")}
                          onClick={() => r && setOpen({ dtw: d.kode, tanggal: day.tanggal })}>
                          {r ? (<><span className="n">{nf.format(r.wisnus + r.wisman)}<br /><small>{nf.format(r.wisnus)} / {nf.format(r.wisman)}</small></span><span className={"st-pill st-" + r.status}>{STATUS[r.status]}</span></>)
                            : <span className="st-pill st-kosong">{!day.lewat ? "—" : d.jalur === "petugas" ? "Belum diisi" : "Tidak ada data"}</span>}
                        </td>
                      );
                    })}
                    <td className="r"><b>{nf.format(tw)}</b></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="sub" style={{ margin: 0 }}>Angka sel: total orang, lalu wisnus / wisman. Klik sel untuk melihat rincian dan menyetujui atau menolak. ★ = periode libur.</p>
      </section>

      {open && cur && (
        <div className="modal" onClick={() => setOpen(null)}>
          <div onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <h2 style={{ fontSize: 18 }}>{nama(open.dtw)}</h2>
            <span className="muted small">{fmt(open.tanggal, { weekday: "long", day: "numeric", month: "long", year: "numeric" })} · {JALUR[cur.sumber]}</span>
            <div className="bignum"><div><b>{nf.format(cur.wisnus)}</b><span>Wisnus</span></div><div><b>{nf.format(cur.wisman)}</b><span>Wisman</span></div></div>
            <div className="small">
              <div>Status: <span className={"st-pill st-" + cur.status}>{STATUS[cur.status]}</span>{cur.diverifikasi_oleh ? ` oleh ${cur.diverifikasi_oleh}` : ""}</div>
              <div>Diisi oleh: {cur.diisi_oleh || "—"}</div>
              {cur.catatan && <div>Catatan petugas: {cur.catatan}</div>}
              {cur.catatan_verifikasi && <div>Alasan penolakan: {cur.catatan_verifikasi}</div>}
            </div>
            {curDtw?.bisaVerifikasi ? (
              cur.status === "terverifikasi" ? (
                isAdmin ? <button className="btn" disabled={busy} onClick={() => act("buka", [open])}>Buka kunci (admin)</button> : <p className="small muted" style={{ margin: 0 }}>Sudah terkunci. Koreksi hanya lewat admin provinsi.</p>
              ) : (
                <>
                  <input type="text" placeholder="Alasan jika ditolak (wajib untuk menolak)" value={alasan} onChange={(e) => setAlasan(e.target.value)} />
                  <div className="row">
                    <button className="btn" disabled={busy || !alasan.trim()} onClick={() => act("tolak", [open], alasan)}>Tolak</button>
                    <button className="btn primary" disabled={busy} onClick={() => act("setujui", [open])}>Setujui</button>
                  </div>
                </>
              )
            ) : <p className="small muted" style={{ margin: 0 }}>DTW ini di luar wilayah verifikasi Anda.</p>}
            <button className="linkbtn" onClick={() => setOpen(null)}>Tutup</button>
          </div>
        </div>
      )}
    </main>
  );
}

function summarize(items: { dtw: string; tanggal: string }[], nama: (k: string) => string) {
  const by = new Map<string, number>();
  items.forEach((t) => by.set(t.dtw, (by.get(t.dtw) || 0) + 1));
  return [...by].slice(0, 6).map(([k, n]) => `${nama(k)} (${n} hari)`).join(", ") + (by.size > 6 ? ", …" : "");
}
