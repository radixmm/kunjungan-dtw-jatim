"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Script from "next/script";
import { T, type Lang } from "@/lib/i18n";
import type { PublicDtw } from "@/lib/ref";
import { COUNTRIES, TOP_COUNTRIES } from "@/lib/countries";
import { Stamp } from "@/components/Stamp";
import { enqueue, flushQueue, readQueue } from "@/components/offline";
import { makeShareCard } from "@/components/shareCard";

type Prov = { kode: string; nama: string; kab: [string, string][] };
type Props = {
  dtw: PublicDtw; qr: { s: string; t: string }; ticket: string; qrValid: boolean; initialLang: Lang;
  googleClientId: string; demo: boolean; akun: string | null; provinsi: Prov[];
};
type Step = "login" | "form" | "consent" | "done";
type Kat = "keluarga" | "travel_agent" | "rombongan_pribadi" | "sendiri";
type Result = { status: "tercatat" | "sudah_tercatat" | "antre"; groupCode?: string | null; stamps?: number };

declare global {
  interface Window {
    google?: { accounts: { id: {
      initialize: (o: Record<string, unknown>) => void; prompt: () => void;
      renderButton: (el: HTMLElement, o: Record<string, unknown>) => void; disableAutoSelect: () => void;
    } } };
  }
}

const decodeEmail = (jwt: string) => {
  try {
    const p = JSON.parse(atob(jwt.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    const [u, d] = String(p.email).split("@");
    return (u.length <= 2 ? u[0] + "*" : u.slice(0, 2) + "***") + "@" + d;
  } catch { return ""; }
};

export default function CheckinClient(p: Props) {
  const [lang, setLang] = useState<Lang>(p.initialLang);
  const t = T[lang];
  const [step, setStep] = useState<Step>(p.akun ? "form" : "login");
  const [akun, setAkun] = useState<string | null>(p.akun);
  const [credential, setCredential] = useState<string>("");
  const [demoEmail, setDemoEmail] = useState("");
  const [offlineMode, setOfflineMode] = useState(false);
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState(0);

  const [pax, setPax] = useState(1);
  const [kat, setKat] = useState<Kat | "">("");
  const [isGuide, setIsGuide] = useState(false);
  const [linked, setLinked] = useState(false);
  const [gcode, setGcode] = useState("");
  const [asalTipe, setAsalTipe] = useState<"wisnus" | "wisman" | "">("");
  const [prov, setProv] = useState("");
  const [kab, setKab] = useState("");
  const [negara, setNegara] = useState("");
  const [consent, setConsent] = useState(false);
  const [adult, setAdult] = useState(false);
  const [geoOn, setGeoOn] = useState(true);
  const [errs, setErrs] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [res, setRes] = useState<Result | null>(null);
  const [visitDate] = useState(() => new Date());
  const gBtn = useRef<HTMLDivElement>(null);
  const stampRef = useRef<HTMLDivElement>(null);

  // Bahasa otomatis mengikuti bahasa ponsel (navigator.language), tetap bisa diganti manual.
  useEffect(() => {
    const saved = (() => { try { return localStorage.getItem("pwj_lang"); } catch { return null; } })();
    if (saved === "id" || saved === "en") setLang(saved);
    else setLang(/^(id|ms|jv|su)\b/i.test(navigator.language) ? "id" : "en");
  }, []);
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);
  const chooseLang = (l: Lang) => { setLang(l); try { localStorage.setItem("pwj_lang", l); } catch { /* */ } };

  // Status jaringan + service worker + kirim antrean offline yang tertunda.
  useEffect(() => {
    const upd = () => setOnline(navigator.onLine);
    upd(); setPending(readQueue().length);
    window.addEventListener("online", upd); window.addEventListener("offline", upd);
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
    return () => { window.removeEventListener("online", upd); window.removeEventListener("offline", upd); };
  }, []);
  useEffect(() => {
    if (!online || !pending || !(akun || credential || demoEmail)) return;
    flushQueue(credential ? { credential } : demoEmail ? { demoEmail } : {}).then((r) => {
      setPending(r.left);
      if (r.sent && res?.status === "antre") setRes({ ...res, status: "tercatat" });
    });
  }, [online, pending, akun, credential, demoEmail, res]);

  // Google Identity Services: tombol + One Tap (auto-select untuk akun yang pernah dipakai).
  const initGoogle = () => {
    if (!p.googleClientId || !window.google || !gBtn.current) return;
    window.google.accounts.id.initialize({
      client_id: p.googleClientId, auto_select: true, itp_support: true, use_fedcm_for_prompt: true, context: "signin",
      callback: (r: { credential: string }) => { setCredential(r.credential); setAkun(decodeEmail(r.credential)); setStep("form"); },
    });
    window.google.accounts.id.renderButton(gBtn.current, { theme: "filled_blue", size: "large", shape: "pill", text: "continue_with", width: 300, locale: lang });
    window.google.accounts.id.prompt();
  };
  useEffect(() => { if (step === "login") initGoogle(); }, [step, lang]); // eslint-disable-line react-hooks/exhaustive-deps

  const kabList = useMemo(() => p.provinsi.find((x) => x.kode === prov)?.kab || [], [prov, p.provinsi]);
  const countryNames = useMemo(() => {
    const dn = new Intl.DisplayNames([lang], { type: "region" });
    const all = COUNTRIES.map((c) => [c, dn.of(c) || c] as const).sort((a, b) => a[1].localeCompare(b[1], lang));
    return { top: TOP_COUNTRIES.map((c) => [c, dn.of(c) || c] as const), all };
  }, [lang]);

  const validateForm = () => {
    const e = new Set<string>();
    if (!kat) e.add("kat");
    if (kat !== "sendiri" && !(linked && kat === "travel_agent") && (!pax || pax < 1)) e.add("pax");
    if (!asalTipe) e.add("asal");
    if (asalTipe === "wisnus" && !prov) e.add("prov");
    if (asalTipe === "wisnus" && prov && !kab) e.add("kab");
    if (asalTipe === "wisman" && !negara) e.add("negara");
    setErrs(e);
    return e.size === 0;
  };

  const getGeo = () => new Promise<Record<string, unknown> | null>((resolve) => {
    if (!geoOn || !navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, acc: Math.round(pos.coords.accuracy) }),
      (e) => resolve(e.code === e.PERMISSION_DENIED ? { denied: true } : null),
      { enableHighAccuracy: true, timeout: 6000, maximumAge: 120000 });
  });

  const submit = async () => {
    if (!consent || !adult) { setErrs(new Set(["consent"])); return; }
    setBusy(true); setErr("");
    const body: Record<string, unknown> = {
      kode: p.dtw.id, s: p.qr.s, t: p.qr.t, ticket: p.ticket, pax: kat === "sendiri" ? 1 : pax, kategori: kat,
      isGuide, linkedGroup: linked, groupCode: gcode, asalTipe, prov, kab, negara, consent, adult,
      lang, clientTime: visitDate.toISOString(), geo: await getGeo(),
    };
    if (credential) body.credential = credential;
    if (p.demo && demoEmail) body.demoEmail = demoEmail;
    const queueIt = () => { enqueue(body); setPending(readQueue().length); setRes({ status: "antre" }); setStep("done"); };
    if (!navigator.onLine || offlineMode) { queueIt(); setBusy(false); return; }
    try {
      const r = await fetch("/api/checkin", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const j = await r.json().catch(() => ({}));
      if (r.ok) { setRes({ status: j.status, groupCode: j.groupCode, stamps: j.stamps }); if (j.akun) setAkun(j.akun); setStep("done"); }
      else if (j.error === "qr_tidak_valid") setErr(t.errQr);
      else if (r.status === 401) { setErr(t.errGeneric); setStep("login"); setCredential(""); setAkun(null); }
      else if (r.status >= 500) queueIt();
      else setErr(`${t.errGeneric} (${j.error || r.status})`);
    } catch { queueIt(); }
    setBusy(false);
  };

  const share = async () => {
    const svg = stampRef.current?.querySelector("svg") as SVGSVGElement | null;
    const blob = await makeShareCard({ title: t.shareCard, nama: p.dtw.nama, kab: p.dtw.kab, tanggal: fmtDate(visitDate, lang), stampSvg: svg, brand: t.brand });
    const file = new File([blob], `paspor-wisata-jatim-${p.dtw.id}.png`, { type: "image/png" });
    const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
    if (nav.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], text: t.shareText(p.dtw.nama) }).catch(() => {});
    } else {
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = file.name; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    }
  };

  const stepNo = step === "login" ? 1 : step === "form" ? 2 : 3;

  return (
    <main className="ci">
      {p.googleClientId && <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" onLoad={initGoogle} />}
      <div className="ci-top">
        <span className="ci-brand"><Logo />{t.brand}</span>
        <div className="lang" role="group" aria-label="Bahasa / Language">
          <button type="button" aria-pressed={lang === "id"} onClick={() => chooseLang("id")}>ID</button>
          <button type="button" aria-pressed={lang === "en"} onClick={() => chooseLang("en")}>EN</button>
        </div>
      </div>

      {p.demo && <div className="demo-flag">MODE DEMO — login Google belum dikonfigurasi; data ditandai sebagai uji coba.</div>}
      {!online && <div className="alert warn">{lang === "id" ? "Tidak ada sinyal. Anda tetap bisa mengisi; data dikirim saat online." : "Offline. You can still fill in the form; it will be sent once you're online."}</div>}
      {pending > 0 && step !== "done" && <div className="alert">{lang === "id" ? `${pending} kunjungan menunggu dikirim.` : `${pending} visit(s) waiting to be sent.`}</div>}

      <header className="hero">
        <span className="kicker">{t.welcome}</span>
        <h1>{p.dtw.nama}</h1>
        <span className="loc">{[p.dtw.lokasi, p.dtw.kab].filter(Boolean).join(" · ")}</span>
      </header>

      {!p.qrValid && step !== "done" ? (
        <div className="alert bad" role="alert">{t.errQr}</div>
      ) : step !== "done" ? (
        <section className="card" aria-live="polite">
          <div className="stepper" aria-label={t.step(stepNo)}>
            <i className="on" /><i className={stepNo >= 2 ? "on" : ""} /><i className={stepNo >= 3 ? "on" : ""} />
            <span>{t.step(stepNo)}</span>
          </div>

          {step === "login" && (
            <>
              <h2>{t.login}</h2>
              <p className="muted small" style={{ margin: 0 }}>{t.intro}</p>
              {p.googleClientId ? (
                <div className="gbtn" ref={gBtn} />
              ) : (
                <>
                  <div className="field">
                    <label htmlFor="demo-email">{t.demoEmail}</label>
                    <input id="demo-email" type="email" inputMode="email" autoComplete="email" placeholder="nama@contoh.id" value={demoEmail} onChange={(e) => setDemoEmail(e.target.value)} />
                  </div>
                  <button className="btn primary block" type="button" disabled={!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(demoEmail)}
                    onClick={() => { setAkun(decodeEmailDemo(demoEmail)); setStep("form"); }}>{t.demoLogin}</button>
                </>
              )}
              <p className="muted small" style={{ margin: 0 }}>{t.loginWhy}</p>
              {!online && (
                <button className="btn block" type="button" onClick={() => { setOfflineMode(true); setStep("form"); }}>
                  {lang === "id" ? "Tidak ada sinyal? Isi dulu, kirim nanti" : "No signal? Fill in now, send later"}
                </button>
              )}
            </>
          )}

          {step === "form" && (
            <>
              {akun && (
                <div className="who"><span>{t.loggedAs} <b>{akun}</b></span>
                  <button type="button" className="linkbtn" onClick={() => { window.google?.accounts.id.disableAutoSelect(); setCredential(""); setAkun(null); setStep("login"); }}>{t.switchAcc}</button>
                </div>
              )}
              <div className={"field" + (errs.has("kat") ? " err" : "")}>
                <span className="lbl" id="kat-l">{t.kategori}</span>
                <div className="opts" role="radiogroup" aria-labelledby="kat-l">
                  {(["keluarga", "rombongan_pribadi", "travel_agent", "sendiri"] as Kat[]).map((k) => (
                    <button key={k} type="button" role="radio" aria-checked={kat === k} className="opt"
                      onClick={() => { setKat(k); if (k === "sendiri") setPax(1); else if (pax < 2) setPax(k === "travel_agent" ? 10 : 2); if (k !== "travel_agent") { setIsGuide(false); setLinked(false); } }}>
                      <span className="dot" />{t.kat[k]}
                    </button>
                  ))}
                </div>
              </div>

              {kat === "travel_agent" && (
                <div className="field">
                  <label className="check"><input type="checkbox" checked={isGuide} onChange={(e) => { setIsGuide(e.target.checked); if (e.target.checked) setLinked(false); }} />{t.guideQ}</label>
                  <label className="check"><input type="checkbox" checked={linked} onChange={(e) => { setLinked(e.target.checked); if (e.target.checked) setIsGuide(false); }} />{t.linkedQ}</label>
                  {linked && (<><p className="help">{t.linkedHelp}</p>
                    <input type="text" aria-label={t.groupCode} placeholder={t.groupCode} value={gcode} maxLength={8} autoCapitalize="characters" onChange={(e) => setGcode(e.target.value)} /></>)}
                </div>
              )}

              {kat && kat !== "sendiri" && !linked && (
                <div className={"field" + (errs.has("pax") ? " err" : "")}>
                  <label htmlFor="pax">{t.pax}</label>
                  <div className="num">
                    <button type="button" aria-label="−" onClick={() => setPax(Math.max(1, pax - 1))}>−</button>
                    <input id="pax" type="text" inputMode="numeric" pattern="[0-9]*" value={pax || ""} onChange={(e) => setPax(Math.min(200, Number(e.target.value.replace(/\D/g, "")) || 0))} />
                    <button type="button" aria-label="+" onClick={() => setPax(Math.min(200, pax + 1))}>+</button>
                  </div>
                </div>
              )}

              <div className={"field" + (errs.has("asal") ? " err" : "")}>
                <span className="lbl" id="asal-l">{t.asal}</span>
                <p className="help">{t.asalHelp}</p>
                <div className="opts two" role="radiogroup" aria-labelledby="asal-l">
                  <button type="button" role="radio" aria-checked={asalTipe === "wisnus"} className="opt" onClick={() => setAsalTipe("wisnus")}><span className="dot" />{t.wisnus}</button>
                  <button type="button" role="radio" aria-checked={asalTipe === "wisman"} className="opt" onClick={() => setAsalTipe("wisman")}><span className="dot" />{t.wisman}</button>
                </div>
              </div>
              {asalTipe === "wisnus" && (
                <>
                  <div className={"field" + (errs.has("prov") ? " err" : "")}>
                    <label htmlFor="prov">{t.prov}</label>
                    <select id="prov" value={prov} onChange={(e) => { setProv(e.target.value); setKab(""); }}>
                      <option value="">{t.pilih}</option>
                      <option value="35">Jawa Timur</option>
                      <optgroup label="—">{p.provinsi.filter((x) => x.kode !== "35").map((x) => <option key={x.kode} value={x.kode}>{x.nama}</option>)}</optgroup>
                    </select>
                  </div>
                  {prov && (
                    <div className={"field" + (errs.has("kab") ? " err" : "")}>
                      <label htmlFor="kab">{t.kab}</label>
                      <select id="kab" value={kab} onChange={(e) => setKab(e.target.value)}>
                        <option value="">{t.pilih}</option>
                        {kabList.map(([k, n]) => <option key={k} value={k}>{n}</option>)}
                      </select>
                    </div>
                  )}
                </>
              )}
              {asalTipe === "wisman" && (
                <div className={"field" + (errs.has("negara") ? " err" : "")}>
                  <label htmlFor="negara">{t.negara}</label>
                  <select id="negara" value={negara} onChange={(e) => setNegara(e.target.value)}>
                    <option value="">{t.pilih}</option>
                    <optgroup label="★">{countryNames.top.map(([c, n]) => <option key={"t" + c} value={c}>{n}</option>)}</optgroup>
                    <optgroup label="A–Z">{countryNames.all.map(([c, n]) => <option key={c} value={c}>{n}</option>)}</optgroup>
                  </select>
                </div>
              )}
              {errs.size > 0 && <div className="alert bad">{t.required}</div>}
              <div className="row">
                {!akun && !offlineMode ? <button className="btn" type="button" onClick={() => setStep("login")}>{t.back}</button> : null}
                <button className="btn primary" type="button" onClick={() => { if (validateForm()) setStep("consent"); }}>{t.next}</button>
              </div>
            </>
          )}

          {step === "consent" && (
            <>
              <h2>{t.consentTitle}</h2>
              <div className="consent" tabIndex={0}><ul>{t.consentBody.map((x, i) => <li key={i}>{x}</li>)}</ul></div>
              <div className={"field" + (errs.has("consent") ? " err" : "")}>
                <label className="check"><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />{t.consentAgree}</label>
                <label className="check"><input type="checkbox" checked={adult} onChange={(e) => setAdult(e.target.checked)} />{t.adult}</label>
                <label className="check"><input type="checkbox" checked={geoOn} onChange={(e) => setGeoOn(e.target.checked)} />{t.geoAsk}</label>
              </div>
              {err && <div className="alert bad" role="alert">{err}</div>}
              <div className="row">
                <button className="btn" type="button" onClick={() => setStep("form")}>{t.back}</button>
                <button className="btn primary" type="button" disabled={!consent || !adult || busy} onClick={submit}>{busy ? t.saving : t.submit}</button>
              </div>
            </>
          )}
        </section>
      ) : null}

      {step === "done" && res && (
        <>
          <section className="card done" aria-live="polite">
            <div ref={stampRef} className="stampbox"><Stamp nama={p.dtw.nama} kab={p.dtw.kab} kategori={p.dtw.kategori} tanggal={fmtDate(visitDate, lang)} kode={p.dtw.id} /></div>
            <h2>{res.status === "antre" ? t.queuedTitle : res.status === "sudah_tercatat" ? t.dupTitle : t.doneTitle}</h2>
            {res.status === "antre" ? <p className="muted small" style={{ margin: 0 }}>{t.queuedBody}</p>
              : res.stamps ? <p className="muted" style={{ margin: 0 }}>{t.stampsCount(res.stamps)}</p> : null}
            {res.groupCode && (<><p className="small" style={{ margin: 0 }}>{t.groupCodeShow}</p><div className="code">{res.groupCode}</div></>)}
            <div className="row" style={{ width: "100%" }}>
              <button className="btn primary" type="button" onClick={share}>{t.share}</button>
              <a className="btn" href="/paspor">{t.passport}</a>
            </div>
          </section>
          <DtwInfo dtw={p.dtw} t={t} />
          <p className="alert small" style={{ margin: 0 }}>{t.soon}</p>
        </>
      )}

      <footer className="foot">
        <span>{t.notIllegalLottery}</span>
        <span>Dinas Kebudayaan dan Pariwisata Provinsi Jawa Timur · <a href="/privasi">{t.privacy}</a></span>
      </footer>
    </main>
  );
}

function DtwInfo({ dtw, t }: { dtw: PublicDtw; t: (typeof T)["id"] }) {
  const fas = Object.entries(dtw.fasilitas).filter(([, v]) => v);
  const rp = (n: number | null) => (n === 0 ? t.gratis : n != null ? "Rp" + n.toLocaleString("id-ID") : "");
  const harga = dtw.harga ? [rp(dtw.harga[0]), dtw.harga[1] && dtw.harga[1] !== dtw.harga[0] ? rp(dtw.harga[1]) : ""].filter(Boolean).join(" – ") : null;
  return (
    <section className="card">
      <h2>{t.info}</h2>
      {(dtw.dpp || dtw.kspp.length > 0) && <div className="tags">{[dtw.dpp, ...dtw.kspp].filter(Boolean).map((x) => <span className="tag" key={x!}>{x}</span>)}</div>}
      {dtw.deskripsi && <p className="desc">{dtw.deskripsi}</p>}
      <dl className="facts">
        {dtw.buka && <div><dt>{t.jam}</dt><dd>{dtw.buka}–{dtw.tutup}</dd></div>}
        {harga && <div><dt>{t.tiket}</dt><dd>{harga}</dd></div>}
        {fas.length > 0 && <div style={{ gridColumn: "1 / -1" }}><dt>{t.fasilitas}</dt><dd>{fas.map(([k, v]) => (typeof v === "string" && v.length < 60 && !/^(ya|ada|yes)$/i.test(v) ? `${t.fas[k] || k}: ${v}` : t.fas[k] || k)).join(" · ")}</dd></div>}
      </dl>
      {(dtw.gmaps || dtw.ll) && <a className="btn" href={dtw.gmaps || `https://www.google.com/maps?q=${dtw.ll![0]},${dtw.ll![1]}`} target="_blank" rel="noopener">{t.peta}</a>}
      <h3 style={{ fontSize: 15 }}>{t.umkm}</h3>
      {dtw.umkm.length ? (
        <ul style={{ margin: 0, paddingLeft: 18 }}>{dtw.umkm.map((u) => <li key={u.nama}><b>{u.nama}</b>{u.jenis ? ` — ${u.jenis}` : ""}{u.lokasi ? `, ${u.lokasi}` : ""}</li>)}</ul>
      ) : <p className="muted small" style={{ margin: 0 }}>{t.umkmEmpty}</p>}
    </section>
  );
}

function fmtDate(d: Date, lang: Lang) {
  return d.toLocaleDateString(lang === "id" ? "id-ID" : "en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Jakarta" });
}
function decodeEmailDemo(e: string) { const [u, d] = e.split("@"); return (u.length <= 2 ? u[0] + "*" : u.slice(0, 2) + "***") + "@" + d; }

function Logo() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="2" width="18" height="20" rx="3" fill="none" stroke="currentColor" strokeWidth="2" /><circle cx="12" cy="10" r="4" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M7 18h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
  );
}
