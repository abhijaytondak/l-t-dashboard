import type { ReactNode } from "react";
import { T, CHECK, type Swatch } from "./tokens";
import type { CheckResult } from "@lt/shared";

interface PillProps {
  fg: string;
  bg: string;
  dot?: string;
  size?: "sm" | "md";
  children: ReactNode;
}

/** Status pill with a leading dot — the collection's signature status device. */
export function Pill({ fg, bg, dot, size = "md", children }: PillProps) {
  const pad = size === "sm" ? "2px 8px 2px 7px" : "3px 10px 3px 8px";
  const fs = size === "sm" ? 10.5 : 11.5;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, background: bg, color: fg, padding: pad, borderRadius: T.pill, fontFamily: T.sans, fontSize: fs, fontWeight: 600, whiteSpace: "nowrap", lineHeight: 1 }}>
      {dot && <span style={{ width: 6, height: 6, borderRadius: "50%", background: dot, flexShrink: 0 }} />}
      {children}
    </span>
  );
}

/** Pill from a token Swatch (verdict / class / confidence / review). */
export function SwatchPill({ swatch, label, size }: { swatch: Swatch; label?: string; size?: "sm" | "md" }) {
  return <Pill fg={swatch.fg} bg={swatch.bg} dot={swatch.dot} size={size}>{label ?? swatch.label}</Pill>;
}

/** Square check result badge (PASS / WARN / FAIL / PENDING). */
export function CheckBadge({ result }: { result: CheckResult }) {
  const s = CHECK[result] ?? CHECK.PENDING;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 22, height: 22, borderRadius: 7, background: s.bg, color: s.fg, fontFamily: T.mono, fontSize: 12, fontWeight: 700, flexShrink: 0 }}>{s.ch}</span>
  );
}
