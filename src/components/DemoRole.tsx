"use client";
// Mode demo: pilih peran untuk mencoba tampilan admin / verifikator / petugas.
export default function DemoRole({ kabs, dtws, cur }: { kabs: string[]; dtws: { kode: string; nama: string }[]; cur: string }) {
  const set = async (as: string) => { await fetch("/api/demo/as", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ as }) }); location.reload(); };
  return (
    <label className="demo-role">Demo, lihat sebagai:&nbsp;
      <select defaultValue={cur} onChange={(e) => set(e.target.value)}>
        <option value="admin">Admin provinsi</option>
        <optgroup label="Verifikator kab/kota">{kabs.map((k) => <option key={k} value={"verifikator:" + k}>{k}</option>)}</optgroup>
        <optgroup label="Petugas DTW">{dtws.map((d) => <option key={d.kode} value={"petugas:" + d.kode}>{d.nama}</option>)}</optgroup>
      </select>
    </label>
  );
}
