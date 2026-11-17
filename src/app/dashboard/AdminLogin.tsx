"use client";
import StaffLogin from "@/components/StaffLogin";
export default function AdminLogin({ clientId }: { clientId: string }) {
  return <StaffLogin clientId={clientId} judul="Dashboard Kunjungan DTW" sub="Khusus petugas Disbudpar Provinsi dan kab/kota" />;
}
