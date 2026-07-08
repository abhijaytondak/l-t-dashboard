"use client";
import { useEffect } from "react";
import type { ClaimRecord, ReviewStatus } from "@lt/shared";
import { Icon, SwatchPill, VERDICT, VERDICT_LABEL, CLASS, REVIEW, CHECK, T, rupee, ago } from "@lt/ui";
import { buildFeed } from "../lib/buildFeed";

interface Props {
  claim: ClaimRecord | null;
  onClose: () => void;
  onAct: (id: string, status: ReviewStatus) => void;
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
  const v = VERDICT[claim.summary.verdict];
  const rv = REVIEW[claim.review ?? "awaiting"];
  const s = claim.summary;
  const manual = s.verdict === "PUSH_TO_MANUAL";
  const ded = (s.totalDisallowed ?? 0) > 0;
  const payBase = claim.charges.filter((c) => c.classification === "PAYABLE" && c.type !== "GST").reduce((a, c) => a + c.amount, 0);
  const gst = claim.charges.filter((c) => c.classification === "PAYABLE" && c.type === "GST").reduce((a, c) => a + c.amount, 0);
  const awaiting = (claim.review ?? "awaiting") === "awaiting";

  return (
    <>
      <div style={{ position: "sticky", top: 0, background: T.bg, padding: "20px 24px 12px", borderBottom: `1px solid ${T.line}`, zIndex: 2 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <div>
            <div className="mono" style={{ fontSize: 11.5, color: T.muted }}>{claim.id} · submitted {ago(claim.submittedHoursAgo ?? 0)}</div>
            <h2 style={{ fontSize: 23, fontWeight: 700, margin: "5px 0 4px", letterSpacing: "-0.02em" }}>{claim.identity.employeeNameOnBill}</h2>
            <div style={{ fontSize: 13, color: T.ink2 }}>{s.vendor} · {s.claimType} · {s.periodFrom} – {s.periodTo}</div>
          </div>
          <button className="btn" style={{ padding: "6px 9px" }} onClick={onClose}><Icon name="x" /></button>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: v.bg, border: `1px solid ${v.dot}33`, borderRadius: 999, padding: "7px 14px" }}><span style={{ width: 9, height: 9, borderRadius: "50%", background: v.dot }} /><span style={{ fontSize: 13, fontWeight: 700, color: v.fg }}>{VERDICT_LABEL[s.verdict]}</span></div>
          <SwatchPill swatch={rv} label={`Review: ${rv.label}`} />
        </div>
      </div>

      <div style={{ padding: "16px 24px 40px" }}>
        {/* money band */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1.3fr", gap: 10, marginBottom: 12 }}>
          <div className="card" style={{ padding: "13px 15px" }}><div className="lbl" style={{ marginBottom: 6 }}>Gross bill</div><div className="mono" style={{ fontSize: 16, fontWeight: 700 }}>{rupee(s.grossBillAmount)}</div></div>
          <div className="card" style={{ padding: "13px 15px" }}><div className="lbl" style={{ marginBottom: 6 }}>Disallowed</div><div className="mono" style={{ fontSize: 16, fontWeight: 700, color: ded ? T.red : T.ink }}>{ded ? "−" + rupee(s.totalDisallowed) : "—"}</div></div>
          <div style={{ background: manual ? T.surface2 : T.greenBg, border: `1px solid ${manual ? T.line : "rgba(31,157,99,.27)"}`, borderRadius: 12, padding: "14px 16px" }}><div className="lbl" style={{ marginBottom: 6 }}>{manual ? "Payable" : "Approved payable"}</div><div className="mono" style={{ fontSize: 23, fontWeight: 700, color: manual ? T.slate : T.green, letterSpacing: "-0.02em" }}>{manual ? "Pending review" : rupee(s.computedPayable)}</div></div>
        </div>

        {/* callout */}
        {manual ? (
          <div style={{ background: T.redBg, border: `1px solid ${T.red}33`, borderRadius: 12, padding: "14px 16px", marginBottom: 12 }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: T.red, marginBottom: claim.routing.manualReason.length ? 9 : 0 }}>Needs manual review</div>
            {claim.routing.manualReason.map((r, i) => (<div key={i} style={{ display: "flex", gap: 9, marginBottom: 6 }}><span style={{ color: T.red, fontWeight: 700 }}>→</span><span style={{ fontSize: 12.5, color: T.ink2, lineHeight: 1.5 }}>{r}</span></div>))}
          </div>
        ) : ded ? (
          <div style={{ background: T.amberBg, border: `1px solid ${T.amber}33`, borderRadius: 12, padding: "13px 16px", marginBottom: 12, fontSize: 12.5, color: T.ink2, lineHeight: 1.5 }}><b style={{ color: T.amber }}>−{rupee(s.totalDisallowed)} deducted</b> across {claim.disallowances.length} line item(s).</div>
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

        {/* computation */}
        <div className="panelBox">
          <div style={{ padding: "12px 16px 6px", fontSize: 14, fontWeight: 600 }}>Payable computation</div>
          <div style={{ padding: "0 16px 16px" }}><div style={{ border: `1px solid ${T.line}`, borderRadius: 8, overflow: "hidden" }}>
            <div className="prow"><span style={{ color: T.ink2 }}>Total payable charges</span><span className="mono">{s.computedPayable == null ? "—" : rupee(payBase)}</span></div>
            <div className="prow"><span style={{ color: T.ink2 }}>GST (on payable)</span><span className="mono">{s.computedPayable == null ? "—" : rupee(gst)}</span></div>
            <div className="prow"><span style={{ color: T.ink2 }}>Eligible limit (sanction)</span><span className="mono" style={{ color: T.ink2 }}>{rupee(claim.computation.eligibleLimit)}</span></div>
            <div className="prow" style={{ background: s.computedPayable == null ? T.surface2 : T.greenBg, borderBottom: "none" }}><span style={{ fontWeight: 700 }}>Computed payable</span><span className="mono" style={{ fontSize: 15, fontWeight: 700, color: s.computedPayable == null ? T.slate : T.green }}>{s.computedPayable == null ? "Pending" : rupee(s.computedPayable)}</span></div>
          </div></div>
        </div>

        {/* payment */}
        <div className="panelBox">
          <div style={{ padding: "12px 16px 6px", fontSize: 14, fontWeight: 600 }}>Payment</div>
          <div style={{ padding: "0 16px 16px", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <div><div className="lbl">Status</div><div className="mono" style={{ fontSize: 13, color: claim.paymentVerification.status === "PAID" ? T.green : T.slate }}>{claim.paymentVerification.status}</div></div>
            <div><div className="lbl">Amount</div><div className="mono" style={{ fontSize: 13 }}>{rupee(claim.paymentVerification.amountPaid)}</div></div>
            <div><div className="lbl">Mode</div><div style={{ fontSize: 13 }}>{claim.paymentVerification.mode}</div></div>
          </div>
        </div>

        {/* checks */}
        <div className="panelBox">
          <div style={{ padding: "12px 16px 6px", fontSize: 14, fontWeight: 600 }}>Scrutiny checks <span className="mono" style={{ fontSize: 11, color: T.muted }}>({claim.checks.length})</span></div>
          <div style={{ padding: "0 16px 16px", display: "grid", gap: 6 }}>
            {claim.checks.map((c, i) => { const m = CHECK[c.result]; return (<div key={i} style={{ display: "flex", gap: 9, padding: "6px 0" }}><span className="ci" style={{ color: m.fg, background: m.bg }}>{m.ch}</span><div><div style={{ fontSize: 12.5 }}>{c.name}</div><div style={{ fontSize: 11.5, color: T.muted }}>{c.note}</div></div></div>); })}
          </div>
        </div>
      </div>

      {/* sticky action bar */}
      <div style={{ position: "sticky", bottom: 0, background: "#fff", borderTop: `1px solid ${T.line}`, padding: "12px 24px", display: "flex", gap: 10, alignItems: "center", boxShadow: "0 -4px 16px rgba(16,24,40,.05)" }}>
        {awaiting ? (
          <>
            <button className="btn green" onClick={() => onAct(claim.id, "approved")}><Icon name="check" size={14} /> Approve payout</button>
            {manual && <button className="btn ghostRed" onClick={() => onAct(claim.id, "rejected")}><Icon name="x" size={14} /> Reject</button>}
            <button className="btn ghostAmber" onClick={() => onAct(claim.id, "hold")}><Icon name="hold" size={14} /> Put on hold</button>
            <button className="btn" onClick={onExport}><Icon name="download" size={14} /> Export</button>
          </>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: T.ink2 }}>Reviewed — <SwatchPill swatch={rv} /></div>
            <button className="btn" style={{ marginLeft: "auto" }} onClick={() => onAct(claim.id, "awaiting")}><Icon name="refresh" size={14} /> Reopen</button>
            <button className="btn primary" onClick={onExport}><Icon name="download" size={14} /> Export</button>
          </>
        )}
      </div>
    </>
  );
}
