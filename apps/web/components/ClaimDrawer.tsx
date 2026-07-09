"use client";
import { useEffect } from "react";
import type { ClaimRecord, ReviewStatus } from "@lt/shared";
import { statusOf } from "@lt/shared";
import { Icon, SwatchPill, STATUS, CLASS, CHECK, T, rupee } from "@lt/ui";
import { buildFeed } from "../lib/buildFeed";

interface Props {
  claim: ClaimRecord | null;
  onClose: () => void;
  onAct: (id: string, status: ReviewStatus) => void;
}

// Bill period as a human range + day count, e.g. "23 May – 22 Jun 2026 · 31 days".
function fmtPeriod(from: string, to: string) {
  const f = Date.parse(from), t = Date.parse(to);
  if (isNaN(f) || isNaN(t)) return { range: `${from} – ${to}`, days: null as number | null };
  const fs = new Date(f).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  const ts = new Date(t).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  return { range: `${fs} – ${ts}`, days: Math.round((t - f) / 86_400_000) + 1 };
}

export function ClaimDrawer({ claim, onClose, onAct }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const open = !!claim;
  const exportRecord = (c: ClaimRecord) => {
    const blob = new Blob([JSON.stringify(buildFeed(c), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${c.id}.json`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <div id="ov" className={open ? "show" : ""} onClick={onClose} />
      <div id="drawer" className={open ? "show" : ""}>
        {claim && <Body claim={claim} onClose={onClose} onAct={onAct} onExport={() => exportRecord(claim)} />}
      </div>
    </>
  );
}

function Body({ claim, onClose, onAct, onExport }: { claim: ClaimRecord; onClose: () => void; onAct: Props["onAct"]; onExport: () => void }) {
  const s = claim.summary;
  const status = statusOf(s.verdict);
  const sw = STATUS[status];
  const rejected = status === "REJECTED";
  const ded = (s.totalDisallowed ?? 0) > 0;
  const period = fmtPeriod(s.periodFrom, s.periodTo);
  const comp = claim.computation;
  const pay = claim.paymentVerification;
  const paid = pay.status === "PAID";

  const payBase = claim.charges.filter((c) => c.classification === "PAYABLE" && c.type !== "GST").reduce((a, c) => a + c.amount, 0);
  const gst = claim.charges.filter((c) => c.classification === "PAYABLE" && c.type === "GST").reduce((a, c) => a + c.amount, 0);
  const subtotal = payBase + gst;
  const mult = comp.prorationMultiplier ?? 1;
  const prorated = mult < 1;

  const checkTally = { PASS: 0, WARN: 0, FAIL: 0, PENDING: 0 };
  claim.checks.forEach((c) => { checkTally[c.result]++; });

  return (
    <>
      <div style={{ position: "sticky", top: 0, background: T.bg, padding: "20px 24px 14px", borderBottom: `1px solid ${T.line}`, zIndex: 2 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <div>
            <h2 style={{ fontSize: 23, fontWeight: 700, margin: "0 0 8px", letterSpacing: "-0.02em" }}>{claim.identity.employeeNameOnBill}</h2>
            {/* vendor + bill duration, formatted */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, background: T.blueTint, color: T.blue, borderRadius: 8, padding: "4px 10px", fontSize: 12.5, fontWeight: 700 }}>{s.vendor}</span>
              <span style={{ fontSize: 12.5, color: T.ink2 }}>{s.claimType}</span>
              <span style={{ color: T.line }}>·</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, color: T.ink2 }}><Icon name="calendar" size={14} style={{ color: T.muted }} />{period.range}{period.days != null && <span style={{ color: T.muted }}> · {period.days} days</span>}</span>
            </div>
          </div>
          <button className="btn" style={{ padding: "6px 9px" }} onClick={onClose}><Icon name="x" /></button>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: sw.bg, border: `1px solid ${sw.dot}33`, borderRadius: 999, padding: "7px 14px" }}><span style={{ width: 9, height: 9, borderRadius: "50%", background: sw.dot }} /><span style={{ fontSize: 13, fontWeight: 700, color: sw.fg }}>{sw.label}</span></div>
        </div>
      </div>

      <div style={{ padding: "16px 24px 40px" }}>
        {/* money band */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1.3fr", gap: 10, marginBottom: 12 }}>
          <div className="card" style={{ padding: "13px 15px" }}><div className="lbl" style={{ marginBottom: 6 }}>Gross bill</div><div className="mono" style={{ fontSize: 16, fontWeight: 700 }}>{rupee(s.grossBillAmount)}</div></div>
          <div className="card" style={{ padding: "13px 15px" }}><div className="lbl" style={{ marginBottom: 6 }}>Disallowed</div><div className="mono" style={{ fontSize: 16, fontWeight: 700, color: ded ? T.red : T.ink }}>{ded ? "−" + rupee(s.totalDisallowed) : "—"}</div></div>
          <div style={{ background: rejected ? T.surface2 : T.greenBg, border: `1px solid ${rejected ? T.line : "rgba(31,157,99,.27)"}`, borderRadius: 12, padding: "14px 16px" }}><div className="lbl" style={{ marginBottom: 6 }}>{rejected ? "Payable" : "Approved payable"}</div><div className="mono" style={{ fontSize: 23, fontWeight: 700, color: rejected ? T.slate : T.green, letterSpacing: "-0.02em" }}>{rejected ? "Not payable" : rupee(s.computedPayable)}</div></div>
        </div>

        {/* callout */}
        {rejected ? (
          <div style={{ background: T.redBg, border: `1px solid ${T.red}33`, borderRadius: 12, padding: "14px 16px", marginBottom: 12 }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: T.red, marginBottom: claim.routing.manualReason.length ? 9 : 0 }}>Rejected — failed compliance</div>
            {claim.routing.manualReason.map((r, i) => (<div key={i} style={{ display: "flex", gap: 9, marginBottom: 6 }}><span style={{ color: T.red, fontWeight: 700 }}>→</span><span style={{ fontSize: 12.5, color: T.ink2, lineHeight: 1.5 }}>{r}</span></div>))}
          </div>
        ) : ded ? (
          <div style={{ background: T.amberBg, border: `1px solid ${T.amber}33`, borderRadius: 12, padding: "13px 16px", marginBottom: 12, fontSize: 12.5, color: T.ink2, lineHeight: 1.5 }}><b style={{ color: T.amber }}>−{rupee(s.totalDisallowed)} deducted</b> across {claim.disallowances.length} line item(s) — approved on the balance.</div>
        ) : (
          <div style={{ background: T.greenBg, border: `1px solid ${T.green}33`, borderRadius: 12, padding: "13px 16px", marginBottom: 12, fontSize: 12.5, color: T.ink2, lineHeight: 1.5 }}><b style={{ color: T.green }}>Full amount approved</b> — every line classified as payable.</div>
        )}

        {claim._extNotes && <div className="panelBox"><div style={{ padding: "12px 16px" }}><div className="lbl" style={{ marginBottom: 5 }}>Reader notes</div><div style={{ fontSize: 12.5, color: T.ink2, lineHeight: 1.6 }}>{claim._extNotes}</div></div></div>}

        {/* charges */}
        <div className="panelBox">
          <div style={{ padding: "12px 16px 6px", fontSize: 14, fontWeight: 600 }}>Charges extracted <span className="mono" style={{ fontSize: 11, color: T.muted }}>({claim.charges.length})</span></div>
          <div style={{ padding: "0 16px 16px" }}><div style={{ border: `1px solid ${T.line}`, borderRadius: 8, overflow: "hidden" }}>
            {claim.charges.map((ch, i) => {
              const cs = CLASS[ch.classification];
              return (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10, padding: "11px 14px", background: i % 2 ? T.surface2 : "#fff", borderBottom: i < claim.charges.length - 1 ? `1px solid ${T.line}` : "none", alignItems: "center" }}>
                  <div><div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}><span style={{ fontSize: 13 }}>{ch.label}</span><SwatchPill swatch={cs} size="sm" /></div><div style={{ fontSize: 11.5, color: T.muted, marginTop: 3 }}>{ch.reason}</div></div>
                  <div className="num" style={{ fontWeight: 600, color: ch.classification === "DISALLOWED" ? T.red : ch.classification === "ESCALATE" ? T.amber : T.ink }}>{ch.classification === "DISALLOWED" ? "−" : ""}{rupee(ch.amount)}</div>
                </div>
              );
            })}
          </div></div>
        </div>

        {/* deep payable computation */}
        <div className="panelBox">
          <div style={{ padding: "12px 16px 6px", fontSize: 14, fontWeight: 600 }}>Payable computation</div>
          <div style={{ padding: "0 16px 16px" }}><div style={{ border: `1px solid ${T.line}`, borderRadius: 8, overflow: "hidden" }}>
            <div className="prow"><span style={{ color: T.ink2 }}>Total payable charges</span><span className="mono">{rejected ? "—" : rupee(payBase)}</span></div>
            <div className="prow"><span style={{ color: T.ink2 }}>GST (on payable)</span><span className="mono">{rejected ? "—" : rupee(gst)}</span></div>
            <div className="prow"><span style={{ color: T.ink2 }}>Subtotal (payable + GST)</span><span className="mono">{rejected ? "—" : rupee(subtotal)}</span></div>
            {/* proration multiplier — always shown, ×1 unless a partial month applies */}
            <div className="prow" style={{ background: prorated ? T.amberBg : "transparent", alignItems: "flex-start" }}>
              <span style={{ color: prorated ? T.amber : T.ink2, fontWeight: prorated ? 700 : 400 }}>
                Proration multiplier
                <span style={{ display: "block", fontWeight: 400, fontSize: 11, color: T.muted, marginTop: 2, maxWidth: 300, lineHeight: 1.45 }}>{comp.prorationReason}</span>
              </span>
              <span className="mono" style={{ fontWeight: 700, color: prorated ? T.amber : T.ink }}>×{mult}</span>
            </div>
            <div className="prow"><span style={{ color: T.ink2 }}>Eligible limit (sanction)</span><span className="mono" style={{ color: T.ink2 }}>{rupee(comp.eligibleLimit)}</span></div>
            <div className="prow" style={{ background: rejected ? T.surface2 : T.greenBg, borderBottom: "none" }}><span style={{ fontWeight: 700 }}>Computed payable</span><span className="mono" style={{ fontSize: 15, fontWeight: 700, color: rejected ? T.slate : T.green }}>{rejected ? "Not payable" : rupee(s.computedPayable)}</span></div>
          </div>
          {!rejected && prorated && <div style={{ fontSize: 11.5, color: T.muted, marginTop: 8, lineHeight: 1.5 }}>{rupee(subtotal)} × {mult} = {rupee(s.computedPayable)} — prorated for a partial billing month.</div>}
          </div>
        </div>

        {/* UPI payment information */}
        <div className="panelBox">
          <div style={{ padding: "12px 16px 6px", fontSize: 14, fontWeight: 600, display: "flex", alignItems: "center", gap: 7 }}><Icon name="creditCard" size={15} style={{ color: T.blue }} /> UPI payment information</div>
          {paid ? (
            <>
              <div style={{ padding: "4px 16px 14px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <PayField icon="clock" label="Payment time" value={`${pay.paymentDate} · ${pay.paymentTime}`} />
                <PayField icon="wallet" label="Amount paid" value={rupee(pay.amountPaid)} mono />
                <PayField icon="store" label="Merchant / payee" value={pay.merchantName} />
                <PayField icon="hash" label="Transaction ID" value={pay.transactionId} mono />
              </div>
              <div style={{ margin: "0 16px 16px", padding: "9px 12px", borderRadius: 8, background: pay.matchToBill === "MATCH" ? T.greenBg : T.amberBg, fontSize: 11.5, color: T.ink2, display: "flex", alignItems: "center", gap: 8 }}>
                <span className="ci" style={{ width: 18, height: 18, fontSize: 11, ...(pay.matchToBill === "MATCH" ? { color: T.green, background: "transparent" } : { color: T.amber, background: "transparent" }) }}>{pay.matchToBill === "MATCH" ? "✓" : "!"}</span>
                {pay.matchNote}
              </div>
            </>
          ) : (
            <div style={{ padding: "4px 16px 16px", fontSize: 12.5, color: T.muted }}>No UPI payment captured for this claim.</div>
          )}
        </div>

        {/* security / compliance checks */}
        <div className="panelBox">
          <div style={{ padding: "12px 16px 6px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 14, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 7 }}><Icon name="shield" size={15} style={{ color: T.blue }} /> Security & compliance checks <span className="mono" style={{ fontSize: 11, color: T.muted }}>({claim.checks.length})</span></span>
            <div style={{ display: "flex", gap: 6 }}>
              <TallyPill n={checkTally.PASS} fg={T.green} bg={T.greenBg} label="pass" />
              {checkTally.WARN > 0 && <TallyPill n={checkTally.WARN} fg={T.amber} bg={T.amberBg} label="warn" />}
              {checkTally.FAIL > 0 && <TallyPill n={checkTally.FAIL} fg={T.red} bg={T.redBg} label="fail" />}
            </div>
          </div>
          <div style={{ padding: "0 16px 16px", display: "grid", gap: 6 }}>
            {claim.checks.map((c, i) => { const m = CHECK[c.result]; return (<div key={i} style={{ display: "flex", gap: 9, padding: "6px 0", borderTop: i ? `1px solid ${T.line}` : "none" }}><span className="ci" style={{ color: m.fg, background: m.bg }}>{m.ch}</span><div><div style={{ fontSize: 12.5 }}>{c.name}</div><div style={{ fontSize: 11.5, color: T.muted }}>{c.note}</div></div></div>); })}
          </div>
        </div>
      </div>

      {/* sticky action bar */}
      <div style={{ position: "sticky", bottom: 0, background: "#fff", borderTop: `1px solid ${T.line}`, padding: "12px 24px", display: "flex", gap: 10, alignItems: "center", boxShadow: "0 -4px 16px rgba(16,24,40,.05)" }}>
        <button className="btn green" onClick={() => onAct(claim.id, "approved")}><Icon name="check" size={14} /> Approve payout</button>
        <button className="btn ghostRed" onClick={() => onAct(claim.id, "rejected")}><Icon name="x" size={14} /> Reject</button>
        <button className="btn" style={{ marginLeft: "auto" }} onClick={onExport}><Icon name="download" size={14} /> Export</button>
      </div>
    </>
  );
}

function PayField({ icon, label, value, mono }: { icon: "clock" | "wallet" | "store" | "hash"; label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="lbl" style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 4 }}><Icon name={icon} size={12} style={{ color: T.muted }} />{label}</div>
      <div className={mono ? "mono" : ""} style={{ fontSize: 13, color: T.ink }}>{value}</div>
    </div>
  );
}

function TallyPill({ n, fg, bg, label }: { n: number; fg: string; bg: string; label: string }) {
  return <span style={{ fontSize: 11, fontWeight: 700, color: fg, background: bg, borderRadius: 999, padding: "3px 9px" }}>{n} {label}</span>;
}
