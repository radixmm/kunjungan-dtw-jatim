"use client";
import { useEffect, useState } from "react";

export default function RotatingQr({ kode, nama, kab }: { kode: string; nama: string; kab: string }) {
  const [img, setImg] = useState(""); const [left, setLeft] = useState(60); const [err, setErr] = useState(false);
  useEffect(() => {
    let exp = 0;
    const tick = async () => {
      const now = Date.now();
      if (now >= exp) {
        try {
          const r = await fetch(`/api/qr?kode=${encodeURIComponent(kode)}`, { cache: "no-store" });
          const j = await r.json(); setImg(j.img); exp = j.expiresAt; setErr(false);
        } catch { setErr(true); exp = now + 5000; }
      }
      setLeft(Math.max(0, Math.ceil((exp - now) / 1000)));
    };
    tick(); const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [kode]);
  return (
    <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", background: "#fff", color: "#111", padding: 16 }}>
      <div style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: 10, alignItems: "center", maxWidth: 560 }}>
        <b style={{ letterSpacing: ".06em" }}>PASPOR WISATA JATIM</b>
        <h1 style={{ fontSize: 30 }}>{nama}</h1>
        <span>{kab}</span>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {img ? <img src={img} alt="QR check-in" style={{ width: "min(80vw, 480px)", height: "auto" }} /> : <div style={{ width: 320, height: 320 }} />}
        <span style={{ fontSize: 18 }}>Pindai untuk check-in · <i>Scan to check in</i></span>
        <span style={{ color: err ? "#b3261e" : "#555", fontVariantNumeric: "tabular-nums" }}>{err ? "Koneksi terputus — QR terakhir tetap berlaku ±3 menit" : `QR berganti dalam ${left} detik`}</span>
      </div>
    </main>
  );
}
