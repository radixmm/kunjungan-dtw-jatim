import { getAdmin } from "@/lib/session";
import { config, isDemo } from "@/lib/config";
import { PILOT, DTW } from "@/lib/ref";
import { wibDate } from "@/lib/time";
import Dashboard from "./Dashboard";
import AdminLogin from "./AdminLogin";

export const metadata = { title: "Dashboard Kunjungan DTW · Disbudpar Jatim", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function Page() {
  const admin = await getAdmin();
  if (!admin) return <AdminLogin clientId={config.googleClientId} />;
  const pilot = PILOT.map((p) => ({ kode: p.kode, nama: DTW.get(p.kode)?.nama || p.kode }));
  return <Dashboard demo={isDemo()} pilot={pilot} today={wibDate()} email={admin.email} />;
}
