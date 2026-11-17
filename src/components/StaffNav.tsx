import Link from "next/link";
import type { Staff } from "@/lib/staff";
import { PILOT, DTW } from "@/lib/ref";
import DemoRole from "./DemoRole";

// Navigasi bagian petugas/verifikator/admin. Menu menyesuaikan peran.
export function StaffNav({ st, active }: { st: Staff; active: "dashboard" | "verifikasi" | "petugas" | "admin" | "qr" }) {
  const items: [typeof active, string, string][] = [];
  if (st.isAdmin || st.kabs.length) items.push(["dashboard", "Dashboard", "/dashboard"], ["verifikasi", "Verifikasi", "/verifikasi"]);
  if (st.isAdmin || st.dtws.length) items.push(["petugas", "Mode Petugas", "/petugas"]);
  if (st.isAdmin || st.kabs.length) items.push(["admin", st.isAdmin ? "Admin" : "Akun petugas", "/admin"]);
  if (st.isAdmin) items.push(["qr", "QR DTW", "/qr"]);
  const peran = st.isAdmin ? "Admin provinsi" : st.kabs.length ? `Verifikator ${st.kabs.join(", ")}` : `Petugas ${st.dtws.map((k) => DTW.get(k)?.nama || k).join(", ")}`;
  const kabs = [...new Set(PILOT.map((p) => DTW.get(p.kode)?.kab).filter(Boolean) as string[])].sort();
  const petugasDtw = PILOT.filter((p) => p.jalur === "petugas").map((p) => ({ kode: p.kode, nama: DTW.get(p.kode)?.nama || p.kode }));
  return (
    <nav className="staffnav noprint">
      <div className="staffnav-in">
        <span className="staffnav-brand">Jatim Pass · <span className="muted">{peran}</span></span>
        <div className="staffnav-links">
          {items.map(([k, label, href]) => <Link key={k} href={href} aria-current={active === k ? "page" : undefined}>{label}</Link>)}
        </div>
        {st.demo && <DemoRole kabs={kabs} dtws={petugasDtw} cur={st.isAdmin ? "admin" : st.kabs.length ? "verifikator:" + st.kabs[0] : "petugas:" + st.dtws[0]} />}
      </div>
    </nav>
  );
}
