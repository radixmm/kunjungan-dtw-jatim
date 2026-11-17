import { getStaff } from "@/lib/staff";
import { config } from "@/lib/config";
import { DTW, KAB, PILOT } from "@/lib/ref";
import { StaffNav } from "@/components/StaffNav";
import StaffLogin from "@/components/StaffLogin";
import AdminClient from "./AdminClient";

export const metadata = { title: "Admin · Jatim Pass", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function Page() {
  const st = await getStaff();
  if (!st) return <StaffLogin clientId={config.googleClientId} judul="Admin Jatim Pass" />;
  if (!st.isAdmin && !st.kabs.length) return (<><StaffNav st={st} active="admin" /><main className="pt"><div className="alert">Halaman ini untuk verifikator kab/kota dan admin provinsi.</div></main></>);
  const dtwPetugas = PILOT.filter((p) => p.jalur === "petugas").map((p) => ({ kode: p.kode, nama: DTW.get(p.kode)?.nama || p.kode, kab: DTW.get(p.kode)?.kab || "" }))
    .filter((d) => st.isAdmin || st.kabs.includes(d.kab));
  const dtwOnline = PILOT.filter((p) => p.jalur === "online").map((p) => ({ kode: p.kode, nama: DTW.get(p.kode)?.nama || p.kode }));
  const kabs = Object.keys(KAB).sort((a, b) => a.replace(/^(Kab|Kota) /, "").localeCompare(b.replace(/^(Kab|Kota) /, "")));
  return (<><StaffNav st={st} active="admin" /><AdminClient isAdmin={st.isAdmin} dtwPetugas={dtwPetugas} dtwOnline={dtwOnline} kabs={kabs} /></>);
}
