import { headers } from "next/headers";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { DTW, publicDtw, WILAYAH } from "@/lib/ref";
import { pickLang } from "@/lib/i18n";
import { config, isDemo } from "@/lib/config";
import { verifyQr, signScanTicket } from "@/lib/crypto";
import { getVisitor } from "@/lib/session";
import CheckinClient from "./CheckinClient";

type P = { params: Promise<{ kode: string }>; searchParams: Promise<{ s?: string; t?: string }> };

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const d = DTW.get(decodeURIComponent((await params).kode));
  return { title: d ? `Check-in ${d.nama} · Paspor Wisata Jatim` : "Paspor Wisata Jatim", robots: { index: false } };
}

export default async function Page({ params, searchParams }: P) {
  const kode = decodeURIComponent((await params).kode);
  const dtw = DTW.get(kode);
  if (!dtw) notFound();
  const sp = await searchParams;
  const lang = pickLang((await headers()).get("accept-language"));
  const visitor = await getVisitor();
  const mode = verifyQr(kode, sp.s, sp.t);
  const ticket = mode ? await signScanTicket(kode, mode) : "";
  const provinsi = WILAYAH.provinsi.map((p) => ({ kode: p.kode, nama: p.nama, kab: p.kab }));
  return (
    <CheckinClient
      dtw={publicDtw(dtw)}
      qr={{ s: sp.s || "", t: sp.t || "" }}
      ticket={ticket}
      qrValid={!!mode}
      initialLang={lang}
      googleClientId={config.googleClientId}
      demo={isDemo()}
      akun={visitor?.m || null}
      provinsi={provinsi}
    />
  );
}
