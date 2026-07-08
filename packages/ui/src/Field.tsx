import type { ReactNode } from "react";
import { T } from "./tokens";

export function Field({ label, value, mono, fg }: { label: string; value: ReactNode; mono?: boolean; fg?: string }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontFamily: T.sans, fontSize: 10.5, color: T.muted, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>{label}</div>
      <div style={{ fontFamily: mono ? T.mono : T.sans, fontSize: 13.5, color: fg ?? T.ink, fontWeight: 500, wordBreak: "break-word" }}>{value}</div>
    </div>
  );
}
