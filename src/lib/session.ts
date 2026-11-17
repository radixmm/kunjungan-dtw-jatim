import { cookies } from "next/headers";
import { readSession } from "./crypto";
import { config } from "./config";

export type VisitorSession = { v: string; m: string }; // v = visitor_hash, m = email tersamar (tampilan saja)
export type AdminSession = { role: "admin"; email: string };

export const VISITOR_COOKIE = "pwj_v";
export const ADMIN_COOKIE = "pwj_a";

export async function getVisitor() {
  return readSession<VisitorSession>((await cookies()).get(VISITOR_COOKIE)?.value);
}
/** Admin provinsi atau verifikator kab/kota (akses dashboard). Lihat staff.ts untuk rincian peran. */
export async function getAdmin(): Promise<AdminSession | null> {
  const { getStaff } = await import("./staff");
  const st = await getStaff();
  return st && (st.isAdmin || st.kabs.length) ? { role: "admin", email: st.email } : null;
}
export function isAdminEmail(email: string) {
  const e = email.toLowerCase();
  return config.adminEmails.some((a) => (a.startsWith("@") ? e.endsWith(a) : e === a));
}
