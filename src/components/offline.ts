"use client";
// Antrean check-in offline di perangkat pengunjung. Isian disimpan tanpa token login;
// saat online kembali, dikirim memakai cookie sesi (atau token Google baru).

const KEY = "pwj_antrean_v1";
export type Queued = { body: Record<string, unknown>; savedAt: string };

export function readQueue(): Queued[] {
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; }
}
function writeQueue(q: Queued[]) { try { localStorage.setItem(KEY, JSON.stringify(q)); } catch { /* penyimpanan penuh/diblokir */ } }

export function enqueue(body: Record<string, unknown>) {
  const { credential: _c, ...rest } = body; // token Google tidak disimpan di perangkat
  writeQueue([...readQueue(), { body: { ...rest, offline: true }, savedAt: new Date().toISOString() }]);
}

/** Mengirim antrean. Mengembalikan jumlah terkirim dan apakah perlu login. */
export async function flushQueue(extra: Record<string, unknown> = {}) {
  const q = readQueue();
  if (!q.length || !navigator.onLine) return { sent: 0, needLogin: false, left: q.length };
  const left: Queued[] = [];
  let sent = 0, needLogin = false;
  for (const item of q) {
    try {
      const r = await fetch("/api/checkin", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...item.body, ...extra }) });
      if (r.ok) sent++;
      else if (r.status === 401) { needLogin = true; left.push(item); }
      else if (r.status >= 500) left.push(item); // coba lagi nanti; 4xx lain dibuang karena tidak akan pernah sah
    } catch { left.push(item); }
  }
  writeQueue(left);
  return { sent, needLogin, left: left.length };
}
