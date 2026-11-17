"use client";
import Script from "next/script";
import { useRef, useState } from "react";

export default function AdminLogin({ clientId }: { clientId: string }) {
  const el = useRef<HTMLDivElement>(null);
  const [err, setErr] = useState("");
  const init = () => {
    const g = (window as unknown as { google: { accounts: { id: { initialize: (o: object) => void; renderButton: (e: HTMLElement, o: object) => void } } } }).google;
    g.accounts.id.initialize({
      client_id: clientId,
      callback: async (r: { credential: string }) => {
        const res = await fetch("/api/admin/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ credential: r.credential }) });
        if (res.ok) location.reload();
        else setErr(res.status === 403 ? "Akun ini tidak terdaftar sebagai petugas dashboard." : "Login gagal.");
      },
    });
    if (el.current) g.accounts.id.renderButton(el.current, { theme: "outline", size: "large", text: "signin_with" });
  };
  return (
    <main className="ci">
      <Script src="https://accounts.google.com/gsi/client" onLoad={init} />
      <header className="hero" style={{ paddingTop: 40 }}><h1>Dashboard Kunjungan DTW</h1><span className="loc">Khusus petugas Disbudpar Provinsi Jawa Timur</span></header>
      <section className="card"><div className="gbtn" ref={el} />{err && <div className="alert bad">{err}</div>}</section>
    </main>
  );
}
