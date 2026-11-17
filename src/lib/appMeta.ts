import type { Metadata } from "next";

// Pengaturan "Add to Home Screen" berbeda per kelompok halaman, supaya ikon di layar utama iPhone/iPad/Android
// membuka halaman yang benar: wisatawan → Paspor, Disbudpar → Dashboard, petugas → Mode Petugas.
export const META_WISATAWAN: Metadata = {
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg", apple: "/apple-icon.png" },
  appleWebApp: { capable: true, title: "Jatim Pass", statusBarStyle: "default" },
};
export const META_DASHBOARD: Metadata = {
  manifest: "/manifest-dashboard.webmanifest",
  icons: { icon: "/icon-dashboard.svg", apple: "/apple-dashboard.png" },
  appleWebApp: { capable: true, title: "Dashboard DTW", statusBarStyle: "default" },
};
export const META_PETUGAS: Metadata = {
  manifest: "/manifest-petugas.webmanifest",
  icons: { icon: "/icon-petugas.svg", apple: "/apple-petugas.png" },
  appleWebApp: { capable: true, title: "Petugas DTW", statusBarStyle: "default" },
};
