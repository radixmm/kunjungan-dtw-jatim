// Konfigurasi dari environment. Tanpa GOOGLE_CLIENT_ID aplikasi berjalan dalam MODE DEMO.
const dev = (name: string) => `demo-${name}-ganti-di-produksi-0123456789abcdef`;

export const config = {
  googleClientId: process.env.GOOGLE_CLIENT_ID || "",
  databaseUrl: process.env.DATABASE_URL || "",
  emailPepper: process.env.EMAIL_PEPPER || dev("pepper"),
  qrSecret: process.env.QR_SECRET || dev("qr"),
  sessionSecret: process.env.SESSION_SECRET || dev("session"),
  adminEmails: (process.env.ADMIN_EMAILS || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean),
  geoRadius: Number(process.env.GEO_RADIUS_M || 1500),
  minCell: Number(process.env.MIN_CELL || 1),
  consentVersion: "2026-11-v1",
  offlineMaxHours: 72,
  qrWindowSec: 60,
};

export const isDemo = () => !config.googleClientId;

if (!isDemo() && (!process.env.EMAIL_PEPPER || !process.env.QR_SECRET || !process.env.SESSION_SECRET)) {
  throw new Error("Mode produksi (GOOGLE_CLIENT_ID terisi) wajib mengisi EMAIL_PEPPER, QR_SECRET, dan SESSION_SECRET.");
}
