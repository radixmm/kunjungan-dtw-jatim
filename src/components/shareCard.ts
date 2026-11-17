"use client";
// Kartu bagikan "Saya sudah ke …" (1080×1350, rasio unggahan media sosial) digambar di canvas.

export async function makeShareCard(opts: { title: string; nama: string; kab: string; tanggal: string; stampSvg: SVGSVGElement | null; brand: string }) {
  const W = 1080, H = 1350;
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  const g = c.getContext("2d")!;
  const grd = g.createLinearGradient(0, 0, 0, H); grd.addColorStop(0, "#0d6b77"); grd.addColorStop(1, "#08434b");
  g.fillStyle = grd; g.fillRect(0, 0, W, H);
  g.fillStyle = "rgba(255,255,255,.08)";
  for (let i = 0; i < 9; i++) { g.beginPath(); g.arc(W * 0.85, H * 0.12, 120 + i * 90, 0, Math.PI * 2); g.lineWidth = 2; g.strokeStyle = "rgba(255,255,255,.07)"; g.stroke(); }
  g.fillStyle = "#cfe9eb"; g.font = "700 38px 'Plus Jakarta Sans', sans-serif"; g.fillText(opts.brand.toUpperCase(), 80, 130);
  g.fillStyle = "#ffffff"; g.font = "600 64px 'Plus Jakarta Sans', sans-serif"; g.fillText(opts.title, 80, 300);
  g.font = "800 92px 'Bricolage Grotesque', 'Plus Jakarta Sans', sans-serif";
  const lines = wrap(g, opts.nama, W - 160).slice(0, 3);
  lines.forEach((l, i) => g.fillText(l, 80, 410 + i * 104));
  g.fillStyle = "#cfe9eb"; g.font = "600 44px 'Plus Jakarta Sans', sans-serif"; g.fillText(`${opts.kab}, Jawa Timur`, 80, 430 + lines.length * 104);
  if (opts.stampSvg) {
    const svg = opts.stampSvg.cloneNode(true) as SVGSVGElement;
    svg.setAttribute("width", "500"); svg.setAttribute("height", "500");
    svg.querySelectorAll("text").forEach((t) => t.setAttribute("font-family", "Plus Jakarta Sans, sans-serif"));
    const url = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(new XMLSerializer().serializeToString(svg));
    const img = new Image(); img.src = url; await img.decode().catch(() => {});
    // Stempel dicap di atas "kertas" krem agar warna tinta kategori tetap terbaca.
    g.save(); g.translate(W - 300, H - 330); g.rotate(-0.05);
    g.fillStyle = "#f7f1e3"; g.beginPath(); g.arc(0, 0, 240, 0, Math.PI * 2); g.fill();
    g.drawImage(img, -215, -215, 430, 430); g.restore();
  }
  g.fillStyle = "#ffffff"; g.font = "600 36px 'Plus Jakarta Sans', sans-serif"; g.fillText(opts.tanggal, 80, H - 120);
  g.fillStyle = "#cfe9eb"; g.font = "500 32px 'Plus Jakarta Sans', sans-serif"; g.fillText("#JatimPass", 80, H - 70);
  return new Promise<Blob>((res) => c.toBlob((b) => res(b!), "image/png"));
}

function wrap(g: CanvasRenderingContext2D, text: string, max: number) {
  const out: string[] = []; let line = "";
  for (const w of text.split(/\s+/)) {
    const t = line ? line + " " + w : w;
    if (g.measureText(t).width > max && line) { out.push(line); line = w; } else line = t;
  }
  if (line) out.push(line);
  return out;
}
