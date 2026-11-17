import { META_WISATAWAN } from "@/lib/appMeta";
import { headers } from "next/headers";
import { getVisitor } from "@/lib/session";
import { q } from "@/lib/db";
import { DTW } from "@/lib/ref";
import { pickLang } from "@/lib/i18n";
import { Stamp } from "@/components/Stamp";
import HapusData from "./HapusData";

export const metadata = { ...META_WISATAWAN,  title: "Jatim Pass", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function Paspor() {
  const v = await getVisitor();
  const en = pickLang((await headers()).get("accept-language")) === "en";
  const rows = v ? await q<{ dtw_kode: string; first: string; n: number }>(
    `SELECT dtw_kode, min(visit_date)::text AS first, count(*)::int AS n FROM checkin WHERE visitor_hash = $1 GROUP BY dtw_kode ORDER BY min(visit_at)`, [v.v]) : [];
  const fmt = (d: string) => new Date(d + "T00:00:00").toLocaleDateString(en ? "en-GB" : "id-ID", { day: "numeric", month: "short", year: "numeric" });
  return (
    <main className="ci">
      <div className="ci-top"><span className="ci-brand">Jatim Pass</span></div>
      <header className="hero">
        <h1>{en ? "My passport" : "Paspor saya"}</h1>
        <span className="loc">{v ? `${v.m} · ${rows.length} ${en ? "stamp(s)" : "stempel"}` : en ? "No check-in yet on this device." : "Belum ada check-in dari perangkat ini."}</span>
      </header>
      {rows.length > 0 ? (
        <section className="card">
          <div className="stamps">
            {rows.map((r) => {
              const d = DTW.get(r.dtw_kode);
              return (
                <figure key={r.dtw_kode}>
                  <Stamp nama={d?.nama || r.dtw_kode} kab={d?.kab || ""} tanggal={fmt(r.first)} kode={r.dtw_kode} kategori={d?.kategori} size={130} />
                  <figcaption><b>{d?.nama}</b><br /><span className="muted">{r.n}× {en ? "visit" : "kunjungan"}</span></figcaption>
                </figure>
              );
            })}
          </div>
        </section>
      ) : (
        <section className="card"><p style={{ margin: 0 }}>{en ? "Scan the official QR code at any participating attraction to collect your first stamp." : "Pindai QR resmi di DTW peserta untuk mendapatkan stempel pertama Anda."}</p></section>
      )}
      {v && <HapusData en={en} />}
      <footer className="foot"><a href="/privasi">{en ? "Privacy" : "Privasi"}</a></footer>
    </main>
  );
}
