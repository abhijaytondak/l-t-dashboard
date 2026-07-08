import { Icon } from "@lt/ui";

export function Sidebar() {
  return (
    <aside className="nav">
      <div style={{ padding: "0 6px 22px" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.svg" alt="SalarySe" style={{ height: 26, width: "auto", display: "block", marginBottom: 16 }} />
        <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: "-0.01em", color: "#fff" }}>LT&nbsp;Verify</div>
        <div style={{ fontSize: 10.5, color: "rgba(255,255,255,.6)", marginTop: 3 }}>Communication reimbursement</div>
      </div>
      <div style={{ fontSize: 9.5, fontWeight: 700, color: "rgba(255,255,255,.5)", textTransform: "uppercase", letterSpacing: "0.08em", padding: "0 8px 8px" }}>Review</div>
      <div className="navitem on"><Icon name="file" size={18} /> Claims</div>
      <div style={{ marginTop: "auto", padding: "0 8px", fontSize: 10, color: "rgba(255,255,255,.55)", lineHeight: 1.6 }}>
        <div style={{ height: 1, background: "rgba(255,255,255,.15)", margin: "0 -2px 14px" }} />
        L&amp;T SSC · SalarySe<br />Reviewer console
      </div>
    </aside>
  );
}
