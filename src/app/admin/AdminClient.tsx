"use client";
import { useCallback, useEffect, useState } from "react";

type U = { id: number; email: string; peran: string; kab: string | null; dtw_kode: string | null; dtw_nama: string | null; nama: string | null; dibuat_oleh: string | null };
type L = { id: number; nama: string; mulai: string; selesai: string };
const PERAN: Record<string, string> = { admin: "Admin provinsi", verifikator: "Verifikator kab/kota", petugas: "Petugas DTW" };
const fmt = (s: string) => new Date(s + "T00:00:00").toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });

export default function AdminClient({ isAdmin, dtwPetugas, dtwOnline, kabs }: { isAdmin: boolean; dtwPetugas: { kode: string; nama: string; kab: string }[]; dtwOnline: { kode: string; nama: string }[]; kabs: string[] }) {
  const [tab, setTab] = useState<"akun" | "libur" | "unggah">("akun");
  return (
    <main className="db">
      <div className="db-top"><div><h1>{isAdmin ? "Admin" : "Akun petugas DTW"}</h1><p>{isAdmin ? "Kelola akun, periode libur, dan data sistem tiket online." : "Daftarkan email Google petugas DTW di wilayah Anda."}</p></div></div>
      {isAdmin && (
        <div className="seg" role="tablist" style={{ alignSelf: "flex-start" }}>
          <button aria-pressed={tab === "akun"} onClick={() => setTab("akun")}>Akun</button>
          <button aria-pressed={tab === "libur"} onClick={() => setTab("libur")}>Periode libur</button>
          <button aria-pressed={tab === "unggah"} onClick={() => setTab("unggah")}>Unggah data online</button>
        </div>
      )}
      {tab === "akun" && <Akun isAdmin={isAdmin} dtwPetugas={dtwPetugas} kabs={kabs} />}
      {tab === "libur" && isAdmin && <Libur />}
      {tab === "unggah" && isAdmin && <Unggah dtwOnline={dtwOnline} />}
    </main>
  );
}

function Akun({ isAdmin, dtwPetugas, kabs }: { isAdmin: boolean; dtwPetugas: { kode: string; nama: string; kab: string }[]; kabs: string[] }) {
  const [rows, setRows] = useState<U[]>([]);
  const [f, setF] = useState({ email: "", nama: "", peran: "petugas", kab: "", dtw: dtwPetugas[0]?.kode || "" });
  const [msg, setMsg] = useState("");
  const load = useCallback(async () => { const r = await fetch("/api/admin/pengguna", { cache: "no-store" }); if (r.ok) setRows((await r.json()).rows); }, []);
  useEffect(() => { load(); }, [load]);
  const add = async () => {
    setMsg("");
    const r = await fetch("/api/admin/pengguna", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(f) });
    const j = await r.json().catch(() => ({}));
    if (r.ok) { setF({ ...f, email: "", nama: "" }); setMsg("Akun ditambahkan. Pengguna cukup login dengan akun Google tersebut."); load(); } else setMsg("Gagal: " + (j.error || r.status));
  };
  const del = async (u: U) => { if (!confirm(`Cabut akses ${u.email} (${PERAN[u.peran]})?`)) return; await fetch(`/api/admin/pengguna?id=${u.id}`, { method: "DELETE" }); load(); };
  return (
    <>
      <section className="panel w12" style={{ gridColumn: "auto" }}>
        <h2>Tambah akun</h2>
        <div className="formrow">
          <label>Email Google<input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} placeholder="nama@gmail.com" /></label>
          <label>Nama (opsional)<input type="text" value={f.nama} onChange={(e) => setF({ ...f, nama: e.target.value })} /></label>
          {isAdmin && (
            <label>Peran<select value={f.peran} onChange={(e) => setF({ ...f, peran: e.target.value })}>
              <option value="petugas">Petugas DTW</option><option value="verifikator">Verifikator kab/kota</option><option value="admin">Admin provinsi</option>
            </select></label>
          )}
          {f.peran === "petugas" && (
            <label>DTW<select value={f.dtw} onChange={(e) => setF({ ...f, dtw: e.target.value })}>{dtwPetugas.map((d) => <option key={d.kode} value={d.kode}>{d.nama} ({d.kab})</option>)}</select></label>
          )}
          {f.peran === "verifikator" && (
            <label>Kab/kota<select value={f.kab} onChange={(e) => setF({ ...f, kab: e.target.value })}><option value="">Pilih…</option>{kabs.map((k) => <option key={k} value={k}>{k}</option>)}</select></label>
          )}
          <button className="btn primary" onClick={add} disabled={!f.email || (f.peran === "verifikator" && !f.kab) || (f.peran === "petugas" && !f.dtw)}>Tambah</button>
        </div>
        {msg && <div className="alert small">{msg}</div>}
        <p className="sub" style={{ margin: 0 }}>Login memakai akun Google. Admin provinsi dari pengaturan server (ADMIN_EMAILS) tidak tampil di daftar ini.</p>
      </section>
      <section className="panel w12" style={{ gridColumn: "auto" }}>
        <h2>Daftar akun</h2>
        {rows.length ? (
          <div className="tbl-wrap"><table className="tbl">
            <thead><tr><th>Email</th><th>Nama</th><th>Peran</th><th>Wilayah / DTW</th><th>Didaftarkan oleh</th><th></th></tr></thead>
            <tbody>{rows.map((u) => (
              <tr key={u.id}><td>{u.email}</td><td>{u.nama || "—"}</td><td>{PERAN[u.peran]}</td><td>{u.kab || u.dtw_nama || "Semua"}</td><td className="muted small">{u.dibuat_oleh}</td>
                <td className="r"><button className="linkbtn" onClick={() => del(u)}>Cabut akses</button></td></tr>
            ))}</tbody>
          </table></div>
        ) : <p className="empty">Belum ada akun.</p>}
      </section>
    </>
  );
}

function Libur() {
  const [rows, setRows] = useState<L[]>([]);
  const [f, setF] = useState({ nama: "", mulai: "", selesai: "" });
  const load = useCallback(async () => { const r = await fetch("/api/admin/libur", { cache: "no-store" }); if (r.ok) setRows((await r.json()).rows); }, []);
  useEffect(() => { load(); }, [load]);
  const add = async () => { const r = await fetch("/api/admin/libur", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(f) }); if (r.ok) { setF({ nama: "", mulai: "", selesai: "" }); load(); } };
  const del = async (id: number) => { await fetch(`/api/admin/libur?id=${id}`, { method: "DELETE" }); load(); };
  return (
    <section className="panel w12" style={{ gridColumn: "auto" }}>
      <h2>Periode libur (verifikasi harian)</h2>
      <p className="sub">Selama periode ini, verifikator kab/kota wajib memverifikasi rekap setiap hari (paling lambat H+1). Di luar periode: mingguan.</p>
      <div className="formrow">
        <label>Nama periode<input type="text" value={f.nama} onChange={(e) => setF({ ...f, nama: e.target.value })} placeholder="mis. Libur Natal & Tahun Baru" /></label>
        <label>Mulai<input type="date" value={f.mulai} onChange={(e) => setF({ ...f, mulai: e.target.value })} /></label>
        <label>Selesai<input type="date" value={f.selesai} min={f.mulai} onChange={(e) => setF({ ...f, selesai: e.target.value })} /></label>
        <button className="btn primary" onClick={add} disabled={!f.nama || !f.mulai || !f.selesai}>Tambah</button>
      </div>
      {rows.length ? (
        <table className="tbl"><tbody>{rows.map((l) => <tr key={l.id}><td><b>{l.nama}</b></td><td>{fmt(l.mulai)} – {fmt(l.selesai)}</td><td className="r"><button className="linkbtn" onClick={() => del(l.id)}>Hapus</button></td></tr>)}</tbody></table>
      ) : <p className="empty">Belum ada periode libur.</p>}
    </section>
  );
}

function Unggah({ dtwOnline }: { dtwOnline: { kode: string; nama: string }[] }) {
  const [csv, setCsv] = useState("");
  const [sumber, setSumber] = useState("Balai Besar TNBTS (bromotenggersemeru.id)");
  const [res, setRes] = useState<{ n: number; errors: string[] } | null>(null);
  const kirim = async () => {
    const r = await fetch("/api/admin/unggah", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ csv, sumber }) });
    setRes(await r.json());
  };
  const file = async (fl?: File) => { if (fl) setCsv(await fl.text()); };
  return (
    <section className="panel w12" style={{ gridColumn: "auto" }}>
      <h2>Unggah data sistem tiket online</h2>
      <p className="sub">Format CSV per baris: <code>tanggal,kode_dtw,wisnus,wisman</code>, contoh <code>2026-11-16,{dtwOnline[0]?.kode || "DT.13.0002"},1250,310</code>. Data dari sumber resmi pengelola langsung berstatus terverifikasi. Baris dengan tanggal dan DTW yang sama akan menimpa data sebelumnya.</p>
      <div className="formrow">
        <label>Sumber data<input type="text" value={sumber} onChange={(e) => setSumber(e.target.value)} /></label>
        <label>Berkas CSV<input type="file" accept=".csv,text/csv,.txt" onChange={(e) => file(e.target.files?.[0])} /></label>
      </div>
      <textarea rows={8} value={csv} onChange={(e) => setCsv(e.target.value)} placeholder={"tanggal,kode_dtw,wisnus,wisman\n2026-11-16,DT.13.0002,1250,310"} />
      <button className="btn primary" onClick={kirim} disabled={!csv.trim()} style={{ alignSelf: "flex-start" }}>Unggah</button>
      {res && <div className={"alert" + (res.errors?.length ? " warn" : "")}>{res.n} baris tersimpan.{res.errors?.length ? ` ${res.errors.length} baris ditolak: ${res.errors.join("; ")}` : ""}</div>}
      <p className="sub" style={{ margin: 0 }}>DTW berjalur online: {dtwOnline.map((d) => `${d.nama} (${d.kode})`).join(", ") || "—"}.</p>
    </section>
  );
}
