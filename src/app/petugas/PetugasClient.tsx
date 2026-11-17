"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type D = { kode: string; nama: string; kab: string };
type Rekap = { wisnus: number; wisman: number; status: "diajukan" | "terverifikasi" | "ditolak"; catatan: string | null; catatan_verifikasi: string | null; diverifikasi_oleh: string | null };
type Hari = { tanggal: string; libur: boolean; hitung: { wisnus: number; wisman: number }; rekap: Rekap | null };
type Ringkasan = { today: string; hari: Hari[]; perJam: { jam: number; n: number }[] };
type Ev = { id: string; dtw: string; t: string; wisnus: number; wisman: number };

const QKEY = "pwj_hitung_v1";
const nf = new Intl.NumberFormat("id-ID");
const readQ = (): Ev[] => { try { return JSON.parse(localStorage.getItem(QKEY) || "[]"); } catch { return []; } };
const writeQ = (q: Ev[]) => { try { localStorage.setItem(QKEY, JSON.stringify(q)); } catch { /* */ } };
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now());
const wibDate = (d = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(d);
const fmtTgl = (s: string) => new Date(s + "T00:00:00").toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short" });
const STATUS: Record<string, string> = { diajukan: "Menunggu verifikasi", terverifikasi: "Terverifikasi", ditolak: "Ditolak, perlu diperbaiki" };

export default function PetugasClient({ dtws }: { dtws: D[] }) {
  const [dtw, setDtw] = useState(dtws[0].kode);
  const [data, setData] = useState<Ringkasan | null>(null);
  const [pending, setPending] = useState<Ev[]>([]);
  const [online, setOnline] = useState(true);
  const [rombN, setRombN] = useState("");
  const [last, setLast] = useState<Ev | null>(null);
  const [flash, setFlash] = useState("");
  const [tgl, setTgl] = useState(wibDate());
  const [form, setForm] = useState({ wisnus: "", wisman: "", catatan: "" });
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const flushing = useRef(false);

  useEffect(() => {
    try { const s = localStorage.getItem("pwj_petugas_dtw"); if (s && dtws.some((d) => d.kode === s)) setDtw(s); } catch { /* */ }
    setPending(readQ());
    const upd = () => setOnline(navigator.onLine); upd();
    window.addEventListener("online", upd); window.addEventListener("offline", upd);
    return () => { window.removeEventListener("online", upd); window.removeEventListener("offline", upd); };
  }, [dtws]);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/petugas/ringkasan?dtw=${encodeURIComponent(dtw)}`, { cache: "no-store" });
      if (r.status === 401) { location.reload(); return; }
      if (r.ok) setData(await r.json());
    } catch { /* offline */ }
  }, [dtw]);

  const flush = useCallback(async () => {
    if (flushing.current || !navigator.onLine) return;
    const q = readQ(); if (!q.length) return;
    flushing.current = true;
    try {
      const r = await fetch("/api/petugas/hitung", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ events: q }) });
      if (r.ok) {
        const { done } = await r.json() as { done: string[] };
        const left = readQ().filter((e) => !done.includes(e.id)); writeQ(left); setPending(left); load();
      }
    } catch { /* coba lagi nanti */ }
    flushing.current = false;
  }, [load]);

  useEffect(() => { load(); const a = setInterval(load, 20000); const b = setInterval(flush, 8000); return () => { clearInterval(a); clearInterval(b); }; }, [load, flush]);
  useEffect(() => { if (online) flush(); }, [online, flush]);

  const tap = (wisnus: number, wisman: number, label: string) => {
    const e: Ev = { id: uid(), dtw, t: new Date().toISOString(), wisnus, wisman };
    const q = [...readQ(), e]; writeQ(q); setPending(q); setLast(e);
    setFlash(label); setTimeout(() => setFlash(""), 900);
    if (navigator.vibrate) navigator.vibrate(15);
    setTimeout(flush, 1200);
  };
  const undo = () => { if (last) { tap(-last.wisnus, -last.wisman, "Dibatalkan"); setLast(null); } };

  const today = data?.today || wibDate();
  const pend = useMemo(() => pending.filter((e) => e.dtw === dtw), [pending, dtw]);
  const pendFor = (d: string) => pend.filter((e) => wibDate(new Date(e.t)) === d).reduce((a, e) => ({ wisnus: a.wisnus + e.wisnus, wisman: a.wisman + e.wisman }), { wisnus: 0, wisman: 0 });
  const hari = data?.hari || [];
  const hitungFor = (d: string) => { const h = hari.find((x) => x.tanggal === d)?.hitung || { wisnus: 0, wisman: 0 }; const p = pendFor(d); return { wisnus: h.wisnus + p.wisnus, wisman: h.wisman + p.wisman }; };
  const now = hitungFor(today);
  const sel = hari.find((x) => x.tanggal === tgl);
  const locked = sel?.rekap?.status === "terverifikasi";

  // Isi formulir rekap: pakai rekap yang sudah dikirim, kalau belum ada pakai total tombol hitung.
  useEffect(() => {
    const r = sel?.rekap, h = hitungFor(tgl);
    setForm({ wisnus: String(r ? r.wisnus : Math.max(0, h.wisnus)), wisman: String(r ? r.wisman : Math.max(0, h.wisman)), catatan: r?.catatan || "" });
    setMsg(null);
  }, [tgl, dtw, data?.today, sel?.rekap?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  const kirim = async () => {
    setBusy(true); setMsg(null);
    try {
      const r = await fetch("/api/petugas/rekap", { method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ dtw, tanggal: tgl, wisnus: Number(form.wisnus || 0), wisman: Number(form.wisman || 0), catatan: form.catatan }) });
      const j = await r.json().catch(() => ({}));
      setMsg(r.ok ? { ok: true, t: "Rekap terkirim. Menunggu verifikasi Disbudpar kab/kota." } : { ok: false, t: j.error === "sudah_diverifikasi" ? "Rekap tanggal ini sudah diverifikasi dan terkunci." : "Gagal mengirim (" + (j.error || r.status) + ")." });
      if (r.ok) load();
    } catch { setMsg({ ok: false, t: "Tidak ada sinyal. Coba kirim lagi saat online." }); }
    setBusy(false);
  };

  const d = dtws.find((x) => x.kode === dtw)!;
  return (
    <main className="pt">
      <header className="hero">
        <span className="kicker">Mode Petugas</span>
        {dtws.length > 1 ? (
          <select value={dtw} onChange={(e) => { setDtw(e.target.value); try { localStorage.setItem("pwj_petugas_dtw", e.target.value); } catch { /* */ } }} aria-label="DTW" style={{ fontSize: 18, fontWeight: 700 }}>
            {dtws.map((x) => <option key={x.kode} value={x.kode}>{x.nama}</option>)}
          </select>
        ) : <h1>{d.nama}</h1>}
        <span className="loc">{d.kab} · {d.kode}</span>
      </header>
      {!online && <div className="alert warn">Tidak ada sinyal. Hitungan tetap tersimpan di HP dan terkirim otomatis saat online.</div>}

      <section className="card">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
          <h2 style={{ flex: "none" }}>Hitung hari ini</h2>
          <span className="small muted" style={{ flex: "none" }}>{pend.length ? `${pend.length} ketukan belum terkirim` : "Semua terkirim"}</span>
        </div>
        <div className="bignum">
          <div><b>{nf.format(now.wisnus)}</b><span>Wisnus</span></div>
          <div><b>{nf.format(now.wisman)}</b><span>Wisman</span></div>
        </div>
        <div className="tally">
          <button className="wn" onClick={() => tap(1, 0, "+1 Wisnus")}>+1<small>Wisnus</small></button>
          <button className="wm" onClick={() => tap(0, 1, "+1 Wisman")}>+1<small>Wisman</small></button>
        </div>
        <div className="field">
          <label htmlFor="romb">Rombongan sekaligus (jumlah orang)</label>
          <input id="romb" type="text" inputMode="numeric" value={rombN} onChange={(e) => setRombN(e.target.value.replace(/\D/g, "").slice(0, 3))} placeholder="mis. 35" />
          <div className="row">
            <button className="btn" disabled={!Number(rombN)} onClick={() => { tap(Number(rombN), 0, `+${rombN} Wisnus`); setRombN(""); }}>+ Wisnus</button>
            <button className="btn" disabled={!Number(rombN)} onClick={() => { tap(0, Number(rombN), `+${rombN} Wisman`); setRombN(""); }}>+ Wisman</button>
          </div>
        </div>
        <div className="row">
          <button className="btn" onClick={undo} disabled={!last}>Batalkan ketukan terakhir</button>
        </div>
        {flash && <div role="status" style={{ position: "fixed", left: "50%", bottom: 24, transform: "translateX(-50%)", background: "var(--fg)", color: "var(--bg)", padding: "10px 18px", borderRadius: 999, fontWeight: 700, zIndex: 50 }}>{flash} ✓</div>}
        <p className="small muted" style={{ margin: 0 }}>Tombol hitung membantu mengisi rekap harian. Wisman = wisatawan yang tinggal di luar negeri.</p>
      </section>

      <section className="card">
        <h2>Rekap harian</h2>
        <div className="formrow">
          <label>Tanggal
            <select value={tgl} onChange={(e) => setTgl(e.target.value)}>
              {(hari.length ? hari : [{ tanggal: today, libur: false, hitung: { wisnus: 0, wisman: 0 }, rekap: null }]).map((h) => (
                <option key={h.tanggal} value={h.tanggal}>{fmtTgl(h.tanggal)}{h.tanggal === today ? " (hari ini)" : ""}{h.libur ? " · libur" : ""} · {h.rekap ? STATUS[h.rekap.status] : "belum diisi"}</option>
              ))}
            </select>
          </label>
        </div>
        {sel?.rekap && <div><span className={"st-pill st-" + sel.rekap.status}>{STATUS[sel.rekap.status]}</span>{sel.rekap.status === "ditolak" && sel.rekap.catatan_verifikasi && <span className="small"> Alasan: {sel.rekap.catatan_verifikasi}</span>}</div>}
        <div className="formrow">
          <label>Wisnus<input type="text" inputMode="numeric" value={form.wisnus} disabled={locked} onChange={(e) => setForm({ ...form, wisnus: e.target.value.replace(/\D/g, "") })} /></label>
          <label>Wisman<input type="text" inputMode="numeric" value={form.wisman} disabled={locked} onChange={(e) => setForm({ ...form, wisman: e.target.value.replace(/\D/g, "") })} /></label>
        </div>
        <label className="field"><span className="lbl">Catatan (opsional)</span>
          <input type="text" value={form.catatan} disabled={locked} maxLength={500} placeholder="mis. hujan sore, loket tutup 14.00" onChange={(e) => setForm({ ...form, catatan: e.target.value })} />
        </label>
        {sel && (sel.hitung.wisnus || sel.hitung.wisman) ? <p className="small muted" style={{ margin: 0 }}>Total tombol hitung tanggal ini: {nf.format(hitungFor(tgl).wisnus)} wisnus, {nf.format(hitungFor(tgl).wisman)} wisman.</p> : null}
        {msg && <div className={"alert" + (msg.ok ? "" : " bad")}>{msg.t}</div>}
        <button className="btn primary block" onClick={kirim} disabled={busy || locked}>{locked ? "Sudah diverifikasi" : busy ? "Mengirim…" : sel?.rekap ? "Perbarui rekap" : "Kirim rekap"}</button>
      </section>
    </main>
  );
}
