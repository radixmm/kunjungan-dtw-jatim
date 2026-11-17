"use client";
import Script from "next/script";
import { useRef, useState } from "react";

// Login petugas / verifikator / admin dengan akun Google yang sudah didaftarkan.
export default function StaffLogin({ clientId, judul = "Masuk petugas", sub = "Untuk petugas DTW, verifikator Disbudpar kab/kota, dan Disbudpar Provinsi Jawa Timur" }: { clientId: string; judul?: string; sub?: string }) {
  const el = useRef<HTMLDivElement>(null);
  const [err, setErr] = useState("");
  const init = () => {
    const g = (window as unknown as { google: { accounts: { id: { initialize: (o: object) => void; renderButton: (e: HTMLElement, o: object) => void } } } }).google;
    g.accounts.id.initialize({
      client_id: clientId,
      callback: async (r: { credential: string }) => {
        const res = await fetch("/api/admin/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ credential: r.credential }) });
        if (res.ok) location.reload();
        else setErr(res.status === 403 ? "Akun ini belum didaftarkan. Minta verifikator kab/kota atau Disbudpar Provinsi untuk menambahkan email Anda." : "Login gagal, coba lagi.");
      },
    });
    if (el.current) g.accounts.id.renderButton(el.current, { theme: "outline", size: "large", text: "signin_with" });
  };
  return (
    <main className="ci">
      <Script src="https://accounts.google.com/gsi/client" onLoad={init} />
      <header className="hero" style={{ paddingTop: 40 }}><h1>{judul}</h1><span className="loc">{sub}</span></header>
      <section className="card"><div className="gbtn" ref={el} />{err && <div className="alert bad">{err}</div>}</section>
    </main>
  );
}
