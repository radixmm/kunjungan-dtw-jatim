import { readFileSync } from "node:fs";
import path from "node:path";
import { config } from "./config";

type Row = Record<string, unknown>;
type Driver = { query: (text: string, params?: unknown[]) => Promise<Row[]>; exec: (text: string) => Promise<void> };

const g = globalThis as unknown as { __db?: Promise<Driver> };

async function connect(): Promise<Driver> {
  let drv: Driver;
  if (config.databaseUrl) {
    const postgres = (await import("postgres")).default;
    const sql = postgres(config.databaseUrl, { max: 5, idle_timeout: 20, prepare: false });
    drv = {
      query: async (t, p = []) => (await sql.unsafe(t, p as never[])) as unknown as Row[],
      exec: async (t) => { await sql.unsafe(t); },
    };
  } else {
    // Tanpa DATABASE_URL: PGlite (Postgres dalam WASM) di folder lokal .pglite — hanya untuk uji/demo.
    const { PGlite } = await import("@electric-sql/pglite");
    const dir = process.env.VERCEL ? "memory://" : path.join(process.cwd(), ".pglite");
    const db = new PGlite(dir);
    drv = {
      query: async (t, p = []) => (await db.query<Row>(t, p as unknown[])).rows,
      exec: async (t) => { await db.exec(t); },
    };
  }
  await drv.exec(readFileSync(path.join(process.cwd(), "db", "schema.sql"), "utf8"));
  return drv;
}

export function db() {
  if (!g.__db) g.__db = connect().catch((e) => { g.__db = undefined; throw e; });
  return g.__db;
}

export async function q<T = Row>(text: string, params: unknown[] = []): Promise<T[]> {
  return (await (await db()).query(text, params)) as T[];
}
