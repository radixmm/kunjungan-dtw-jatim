import { getStaff } from "@/lib/staff";
import { config } from "@/lib/config";
import { StaffNav } from "@/components/StaffNav";
import StaffLogin from "@/components/StaffLogin";
import VerifikasiClient from "./VerifikasiClient";

export const metadata = { title: "Verifikasi Rekap DTW · Jatim Pass", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function Page() {
  const st = await getStaff();
  if (!st) return <StaffLogin clientId={config.googleClientId} judul="Verifikasi rekap DTW" sub="Untuk verifikator Disbudpar kab/kota dan Disbudpar Provinsi" />;
  if (!st.isAdmin && !st.kabs.length) return (<><StaffNav st={st} active="verifikasi" /><main className="pt"><div className="alert">Halaman ini untuk verifikator kab/kota dan admin provinsi.</div></main></>);
  return (<><StaffNav st={st} active="verifikasi" /><VerifikasiClient isAdmin={st.isAdmin} wilayah={st.isAdmin ? "Seluruh Jawa Timur" : st.kabs.join(", ")} /></>);
}
