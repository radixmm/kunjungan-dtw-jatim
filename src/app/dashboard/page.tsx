import { getStaff, scopeKodes } from "@/lib/staff";
import { config, isDemo } from "@/lib/config";
import { DTW } from "@/lib/ref";
import { wibDate } from "@/lib/time";
import { StaffNav } from "@/components/StaffNav";
import Dashboard from "./Dashboard";
import AdminLogin from "./AdminLogin";

export const metadata = { title: "Dashboard Kunjungan DTW · Disbudpar Jatim", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function Page() {
  const st = await getStaff();
  if (!st) return <AdminLogin clientId={config.googleClientId} />;
  if (!st.isAdmin && !st.kabs.length) return (<><StaffNav st={st} active="dashboard" /><main className="pt"><div className="alert">Dashboard untuk verifikator kab/kota dan admin provinsi. Silakan buka <a href="/petugas">Mode Petugas</a>.</div></main></>);
  const pilot = scopeKodes(st).map((k) => ({ kode: k, nama: DTW.get(k)?.nama || k }));
  return (
    <>
      <StaffNav st={st} active="dashboard" />
      <Dashboard demo={isDemo()} pilot={pilot} today={wibDate()} email={st.email} wilayah={st.isAdmin ? null : st.kabs.join(", ")} />
    </>
  );
}
