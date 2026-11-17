"use client";
import { useState } from "react";

export default function HapusData({ en }: { en: boolean }) {
  const [done, setDone] = useState(false);
  const go = async () => {
    if (!confirm(en ? "Unlink all your visits from your account? Stamps will be removed; anonymous totals remain." : "Putuskan semua kunjungan dari akun Anda? Stempel akan hilang; angka agregat anonim tetap ada.")) return;
    const r = await fetch("/api/paspor/hapus", { method: "POST" });
    if (r.ok) { setDone(true); setTimeout(() => location.reload(), 1200); }
  };
  return (
    <section className="card">
      <h2 style={{ fontSize: 16 }}>{en ? "Your data" : "Data Anda"}</h2>
      <p className="small muted" style={{ margin: 0 }}>
        {en ? "Under Law No. 27/2022 you may withdraw consent and request deletion. This removes the link between your Google account and all visit records."
            : "Sesuai UU No. 27 Tahun 2022 Anda berhak menarik persetujuan dan meminta penghapusan. Tombol ini memutus kaitan akun Google Anda dengan seluruh catatan kunjungan."}
      </p>
      <button className="btn" type="button" onClick={go} disabled={done}>{done ? (en ? "Done" : "Selesai") : en ? "Withdraw consent & unlink my data" : "Tarik persetujuan & hapus kaitan data saya"}</button>
    </section>
  );
}
