import type { Metadata, Viewport } from "next";
import "./globals.css";
import { META_WISATAWAN } from "@/lib/appMeta";

export const metadata: Metadata = {
  title: "Kunjungan DTW Jatim",
  description: "Pencatatan kunjungan wisatawan berbasis QR — Dinas Kebudayaan dan Pariwisata Provinsi Jawa Timur",
  ...META_WISATAWAN,
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#0d6b77" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" />
      </head>
      <body>{children}</body>
    </html>
  );
}
