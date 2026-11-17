import { notFound, redirect } from "next/navigation";
import { getAdmin } from "@/lib/session";
import { DTW } from "@/lib/ref";
import RotatingQr from "./RotatingQr";

export const dynamic = "force-dynamic";

// Layar QR dinamis untuk tablet di loket. Prototipe: memakai sesi admin; produksi: akun petugas per DTW.
export default async function Page({ params }: { params: Promise<{ kode: string }> }) {
  if (!(await getAdmin())) redirect("/dashboard");
  const kode = decodeURIComponent((await params).kode);
  const d = DTW.get(kode);
  if (!d) notFound();
  return <RotatingQr kode={kode} nama={d.nama} kab={d.kab} />;
}
