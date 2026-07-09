"use client";
import type { ClaimRecord, ClaimStatus } from "@lt/shared";
import { statusOf } from "@lt/shared";
import { Icon, T, rupeeShort, type IconName } from "@lt/ui";

type Filter = "ALL" | ClaimStatus;

export function KpiRow({ claims, onPick }: { claims: ClaimRecord[]; onPick: (t: Filter) => void }) {
  const tot = claims.length || 1;
  const st = (s: ClaimStatus) => claims.filter((c) => statusOf(c.summary.verdict) === s).length;
  const approved = st("APPROVED"), rejected = st("REJECTED");
  const paid = claims.reduce((a, c) => a + (c.summary.computedPayable ?? 0), 0);
  const pct = (x: number) => `${Math.round((x / tot) * 100)}% of claims`;

  const chip = (bg: string, fg: string, name: IconName) => (
    <span className="kchip" style={{ background: bg, color: fg }}><Icon name={name} size={17} /></span>
  );

  return (
    <div style={{ padding: "18px 28px 6px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        <div className="card kcard" style={{ position: "relative" }} onClick={() => onPick("ALL")}>
          <div style={{ padding: "15px 16px" }}><div className="lbl" style={{ marginBottom: 9 }}>Total claims</div><div className="mono" style={{ fontSize: 25, fontWeight: 700 }}>{claims.length}</div><div style={{ fontSize: 11.5, color: T.muted, marginTop: 4 }}>in the feed</div></div>
          {chip(T.surface2, T.ink2, "list")}
        </div>
        <div className="card kcard" style={{ position: "relative" }} onClick={() => onPick("APPROVED")}>
          <div style={{ padding: "15px 16px" }}><div className="lbl" style={{ marginBottom: 9 }}>Approved</div><div className="mono" style={{ fontSize: 25, fontWeight: 700 }}>{approved}</div><div style={{ fontSize: 11.5, color: T.green, marginTop: 4 }}>{pct(approved)}</div></div>
          {chip(T.greenBg, T.green, "checkCircle")}
        </div>
        <div className="card kcard" style={{ position: "relative" }} onClick={() => onPick("REJECTED")}>
          <div style={{ padding: "15px 16px" }}><div className="lbl" style={{ marginBottom: 9 }}>Rejected</div><div className="mono" style={{ fontSize: 25, fontWeight: 700 }}>{rejected}</div><div style={{ fontSize: 11.5, color: T.red, marginTop: 4 }}>{pct(rejected)}</div></div>
          {chip(T.redBg, T.red, "alertTriangle")}
        </div>
        <div className="card" style={{ position: "relative", overflow: "hidden" }}>
          <div style={{ padding: "15px 16px" }}><span style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: T.blue }} /><div className="lbl" style={{ marginBottom: 9 }}>Approved payable</div><div className="mono" style={{ fontSize: 25, fontWeight: 700, color: T.blue }}>{rupeeShort(paid)}</div><div style={{ fontSize: 11.5, color: T.muted, marginTop: 4 }}>cleared to pay</div></div>
          {chip(T.blueTint, T.blue, "wallet")}
        </div>
      </div>
    </div>
  );
}
