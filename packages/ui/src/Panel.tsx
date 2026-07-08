"use client";
import { useState } from "react";
import type { ReactNode } from "react";
import { T } from "./tokens";

interface PanelProps {
  title: string;
  count?: number;
  subtitle?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}

/** Collapsible section — building block of the detail drawer. */
export function Panel({ title, count, subtitle, defaultOpen = false, children }: PanelProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: T.rMd, boxShadow: T.shadow, marginBottom: 12, overflow: "hidden" }}>
      <button onClick={() => setOpen(!open)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "13px 16px", background: "transparent", border: "none", cursor: "pointer", textAlign: "left" }}>
        <span style={{ display: "inline-flex", transform: open ? "rotate(90deg)" : "none", transition: "transform .15s ease", color: T.muted, fontSize: 10 }}>▶</span>
        <span style={{ fontFamily: T.sans, fontSize: 14, fontWeight: 600, color: T.ink }}>{title}</span>
        {count !== undefined && <span style={{ fontFamily: T.mono, fontSize: 11, color: T.ink2, background: T.surface2, border: `1px solid ${T.line}`, borderRadius: T.pill, padding: "1px 8px" }}>{count}</span>}
        {subtitle && <span style={{ marginLeft: "auto", fontFamily: T.sans, fontSize: 12.5, fontWeight: 500, color: T.ink2 }}>{subtitle}</span>}
      </button>
      {open && <div style={{ padding: "0 16px 16px" }}>{children}</div>}
    </div>
  );
}
