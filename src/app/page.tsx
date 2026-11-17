import { META_DASHBOARD } from "@/lib/appMeta";
import Link from "next/link";
import { PILOT, DTW } from "@/lib/ref";
import { isDemo } from "@/lib/config";
import { qrSigStatic } from "@/lib/crypto";

export const metadata = { ...META_DASHBOARD, title: "Kunjungan DTW Jatim" };

export default function Home() {
  const demo = isDemo();
  return (
    <main className="ci" style={{ maxWidth: 760 }}>
      <header className="hero" style={{ paddingTop: 28 }}>
        <span className="kicker">Disbudpar Provinsi Jawa Timur · Bidang Destinasi Pariwisata</span>
        <h1>Pencatatan Kunjungan DTW berbasis QR</h1>
        <span className="loc">Prototipe pilot {PILOT.length} DTW · check-in pengunjung, Jatim Pass, dan dashboard monitoring</span>
      </header>
      {demo && <div className="demo-flag">MODE DEMO: login Google belum dikonfigurasi. Tautan check-in di bawah hanya ditampilkan di mode demo untuk uji coba; di produksi pengunjung harus memindai QR di lokasi.</div>}
      <section className="card">
        <div className="row" style={{ flexWrap: "wrap" }}>
          <Link className="btn primary" href="/dashboard">Dashboard</Link>
          <Link className="btn" href="/qr">QR DTW (cetak / tablet)</Link>
          <Link className="btn" href="/paspor">Paspor saya</Link>
        </div>
      </section>
      <section className="card">
        <h2>DTW pilot</h2>
        <table className="tbl"><tbody>
          {PILOT.map((p) => { const d = DTW.get(p.kode)!; return (
            <tr key={p.kode}><td className="muted">{p.kode}</td><td><b>{d.nama}</b><br /><span className="muted small">{d.kab} · {p.alasan}</span></td>
              <td className="r">{demo ? <Link href={`/c/${p.kode}?s=${qrSigStatic(p.kode)}`}>Coba check-in</Link> : null}</td></tr>); })}
        </tbody></table>
      </section>
    </main>
  );
}
