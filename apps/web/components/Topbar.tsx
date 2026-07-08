"use client";
import { Icon, T } from "@lt/ui";

export function Topbar({ onRefresh, refreshing }: { onRefresh: () => void; refreshing: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "16px 28px", borderBottom: `1px solid ${T.line}`, background: "#fff" }}>
      <div>
        <h1 style={{ fontSize: 19, fontWeight: 700, margin: 0, letterSpacing: "-0.01em" }}>Claims verification</h1>
        <div style={{ fontSize: 12.5, color: T.muted, marginTop: 2 }}>Bills submitted from the employee app — read, classified &amp; computed automatically</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button className="btn" onClick={onRefresh} disabled={refreshing}>
          <Icon name="refresh" /> {refreshing ? "Refreshing…" : "Refresh"}
        </button>
        <button className="btn primary"><Icon name="download" /> Export all</button>
        <span style={{ width: 1, height: 30, background: T.line, margin: "0 7px" }} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/lt-logo.svg" alt="Larsen & Toubro" style={{ height: 40, width: "auto", display: "block" }} />
      </div>
    </div>
  );
}
