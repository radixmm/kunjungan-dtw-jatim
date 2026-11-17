import QRCode from "qrcode";
import { getAdmin } from "@/lib/session";
import { PILOT, DTW } from "@/lib/ref";
import { qrSigStatic } from "@/lib/crypto";
import { baseUrl } from "@/lib/baseurl";
import { redirect } from "next/navigation";
import PrintButton from "./PrintButton";

export const metadata = { title: "QR DTW Pilot", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function QrSheet() {
  if (!(await getAdmin())) redirect("/dashboard");
  const base = await baseUrl();
  const items = await Promise.all(PILOT.map(async (p) => {
    const d = DTW.get(p.kode)!;
    const url = `${base}/c/${p.kode}?s=${qrSigStatic(p.kode)}`;
    return { p, d, url, img: await QRCode.toDataURL(url, { errorCorrectionLevel: "M", margin: 2, width: 600 }) };
  }));
  return (
    <main className="db">
      <div className="db-top noprint">
        <div><h1>QR DTW pilot</h1><p>QR statis untuk dicetak (stiker/banner di loket dan titik foto). QR dinamis untuk tablet petugas loket, berganti tiap 60 detik.</p></div>
        <div style={{ display: "flex", gap: 8 }}><a className="btn" href="/dashboard">Dashboard</a><PrintButton /></div>
      </div>
      <div className="qrsheet">
        {items.map(({ p, d, url, img }) => (
          <figure key={p.kode}>
            <b style={{ fontSize: 13, letterSpacing: ".04em" }}>PASPOR WISATA JATIM</b>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img} alt={`QR check-in ${d.nama}`} />
            <b style={{ fontSize: 17 }}>{d.nama}</b>
            <span style={{ fontSize: 12 }}>{d.kab} · {p.kode}</span>
            <span style={{ fontSize: 12 }}>Pindai untuk check-in &amp; dapatkan stempel digital<br /><i>Scan to check in &amp; collect your digital stamp</i></span>
            <span className="noprint" style={{ fontSize: 11, wordBreak: "break-all", color: "#555" }}>{url}</span>
            <a className="noprint" href={`/qr/${p.kode}`} style={{ fontSize: 12 }}>Buka QR dinamis (tablet loket)</a>
          </figure>
        ))}
      </div>
    </main>
  );
}
