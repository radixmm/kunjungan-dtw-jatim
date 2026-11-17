import { cookies } from "next/headers";
import { readSession } from "./crypto";
import { config, isDemo } from "./config";

export type VisitorSession = { v: string; m: string }; // v = visitor_hash, m = email tersamar (tampilan saja)
export type AdminSession = { role: "admin"; email: string };

export const VISITOR_COOKIE = "pwj_v";
export const ADMIN_COOKIE = "pwj_a";

export async function getVisitor() {
  return readSession<VisitorSession>((await cookies()).get(VISITOR_COOKIE)?.value);
}
export async function getAdmin(): Promise<AdminSession | null> {
  if (isDemo()) return { role: "admin", email: "demo" };
  return readSession<AdminSession>((await cookies()).get(ADMIN_COOKIE)?.value);
}
export function isAdminEmail(email: string) {
  const e = email.toLowerCase();
  return config.adminEmails.some((a) => (a.startsWith("@") ? e.endsWith(a) : e === a));
}
