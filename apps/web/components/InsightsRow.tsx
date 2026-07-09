"use client";
import { useMemo, useRef, useState } from "react";
import type { ClaimRecord } from "@lt/shared";
import { Icon, T } from "@lt/ui";

type Range = "7D" | "1M" | "3M";
const RANGE_DAYS: Record<Range, number> = { "7D": 7, "1M": 30, "3M": 90 };

function IhHeader({ icon, title, right }: { icon: "trendingUp"; title: string; right?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
      <span className="ihd"><span className="icwrap"><Icon name={icon} size={15} /></span>{title}</span>
      {right}
    </div>
  );
}

export function InsightsRow({ claims }: { claims: ClaimRecord[] }) {
  const [range, setRange] = useState<Range>("7D");
  const [hover, setHover] = useState<number | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const n = RANGE_DAYS[range];

  // One bucket per day, oldest → newest. Each claim lands on its submitted day;
  // anything older than the window is clamped into the oldest bucket.
  const { buckets, dates } = useMemo(() => {
    const b = new Array(n).fill(0);
    claims.forEach((c) => {
      const off = Math.floor((c.submittedHoursAgo ?? 0) / 24);
      b[n - 1 - Math.min(off, n - 1)]++;
    });
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const d = b.map((_, j) => {
      const dt = new Date(today); dt.setDate(dt.getDate() - (n - 1 - j));
      return dt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: n > 7 ? "2-digit" : undefined });
    });
    return { buckets: b as number[], dates: d };
  }, [claims, n]);

  const W = 900, H = 120, mx = Math.max(...buckets, 1);
  const xOf = (i: number) => (n === 1 ? W / 2 : (i / (n - 1)) * W);
  const yOf = (v: number) => H - (v / mx) * (H - 20) - 6;
  const pts = buckets.map((v, i) => [xOf(i), yOf(v)] as [number, number]);
  const line = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
  const area = line + ` L ${W} ${H} L 0 ${H} Z`;
  const last = pts[pts.length - 1];

  const onMove = (e: React.MouseEvent) => {
    const el = wrapRef.current; if (!el) return;
    const rect = el.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    setHover(Math.round(ratio * (n - 1)));
  };

  const hx = hover != null ? (hover / (n - 1)) * 100 : 0;
  const hyPx = hover != null ? (pts[hover][1] / H) * 120 : 0;

  return (
    <div style={{ padding: "14px 28px 0" }}>
      <div className="softcard"><div style={{ padding: "16px 20px 14px" }}>
        <IhHeader icon="trendingUp" title="Claims volume" right={
          <div className="seg">
            {(["7D", "1M", "3M"] as Range[]).map((r) => (
              <button key={r} className={range === r ? "on" : ""} onClick={() => { setRange(r); setHover(null); }}>{r}</button>
            ))}
          </div>
        } />
        <div className="mono" style={{ fontSize: 26, fontWeight: 700, margin: "2px 0 12px" }}>{claims.length}<span style={{ fontSize: 12.5, color: T.muted, fontWeight: 500 }}> total claims</span></div>
        <div
          ref={wrapRef}
          onMouseMove={onMove}
          onMouseLeave={() => setHover(null)}
          style={{ position: "relative", backgroundImage: "radial-gradient(rgba(35,69,156,.06) 1px,transparent 1px)", backgroundSize: "16px 16px", borderRadius: 10, cursor: "crosshair" }}
        >
          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: "100%", height: 120, display: "block" }}>
            <defs><linearGradient id="ag" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="rgba(35,69,156,.22)" /><stop offset="1" stopColor="rgba(35,69,156,0)" /></linearGradient></defs>
            <path d={area} fill="url(#ag)" />
            <path d={line} fill="none" stroke={T.blue} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
            <circle cx={last[0].toFixed(1)} cy={last[1].toFixed(1)} r={4} fill="#fff" stroke={T.blue} strokeWidth={2.5} />
          </svg>

          {hover != null && (
            <>
              {/* vertical guide */}
              <div style={{ position: "absolute", top: 0, bottom: 0, left: `${hx}%`, width: 1, background: "rgba(35,69,156,.35)", pointerEvents: "none" }} />
              {/* hover marker */}
              <div style={{ position: "absolute", left: `${hx}%`, top: hyPx, width: 9, height: 9, borderRadius: "50%", background: "#fff", border: `2.5px solid ${T.blue}`, transform: "translate(-50%,-50%)", pointerEvents: "none" }} />
              {/* tooltip */}
              <div style={{ position: "absolute", left: `${Math.min(88, Math.max(12, hx))}%`, top: Math.max(0, hyPx - 12), transform: "translate(-50%,-100%)", background: T.ink, color: "#fff", padding: "6px 10px", borderRadius: 8, fontSize: 11.5, whiteSpace: "nowrap", pointerEvents: "none", boxShadow: "0 6px 18px rgba(16,24,40,.22)", zIndex: 3 }}>
                <div style={{ fontWeight: 700 }}>{dates[hover]}</div>
                <div style={{ color: "rgba(255,255,255,.75)" }}>{buckets[hover]} claim{buckets[hover] === 1 ? "" : "s"}</div>
              </div>
            </>
          )}
        </div>
      </div></div>
    </div>
  );
}
