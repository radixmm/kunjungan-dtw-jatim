import { META_PETUGAS } from "@/lib/appMeta";
import { getStaff } from "@/lib/staff";
import { config } from "@/lib/config";
import { DTW, PILOT } from "@/lib/ref";
import { StaffNav } from "@/components/StaffNav";
import StaffLogin from "@/components/StaffLogin";
import PetugasClient from "./PetugasClient";

export const metadata = { ...META_PETUGAS,  title: "Mode Petugas · Jatim Pass", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function Page() {
  const st = await getStaff();
  if (!st) return <StaffLogin clientId={config.googleClientId} judul="Mode Petugas DTW" sub="Masuk dengan akun Google yang didaftarkan Disbudpar kab/kota" />;
  // Admin boleh membuka mode petugas DTW mana pun yang berjalur petugas (untuk uji/pendampingan).
  const kodes = st.isAdmin ? PILOT.filter((p) => p.jalur === "petugas").map((p) => p.kode) : st.dtws;
  const dtws = kodes.map((k) => ({ kode: k, nama: DTW.get(k)?.nama || k, kab: DTW.get(k)?.kab || "" }));
  return (
    <>
      <StaffNav st={st} active="petugas" />
      {dtws.length ? <PetugasClient dtws={dtws} /> : <main className="pt"><div className="alert">Akun Anda belum ditugaskan ke DTW mana pun.</div></main>}
    </>
  );
}
