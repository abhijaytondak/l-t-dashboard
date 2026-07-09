import type { ClaimRecord } from "@lt/shared";
import { Icon, T } from "@lt/ui";

function IhHeader({ icon, title, right }: { icon: "barChart" | "gauge" | "trendingUp"; title: string; right?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
      <span className="ihd"><span className="icwrap"><Icon name={icon} size={15} /></span>{title}</span>
      {right}
    </div>
  );
}

export function InsightsRow({ claims }: { claims: ClaimRecord[] }) {
  // Claims volume — bucket by submitted-day, oldest → newest.
  const days = [0, 0, 0, 0, 0, 0, 0];
  claims.forEach((c) => { const d = Math.min(6, Math.floor((c.submittedHoursAgo ?? 0) / 24)); days[d]++; });
  const vol = days.slice().reverse();
  const W = 900, H = 120, mx = Math.max(...vol, 1);
  const pts = vol.map((v, i) => [(i / (vol.length - 1)) * W, H - (v / mx) * (H - 20) - 6] as [number, number]);
  const line = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
  const area = line + ` L ${W} ${H} L 0 ${H} Z`;
  const last = pts[pts.length - 1];

  return (
    <div style={{ padding: "14px 28px 0" }}>
      <div className="softcard"><div style={{ padding: "16px 20px 14px" }}>
        <IhHeader icon="trendingUp" title="Claims volume" right={<div className="seg"><button className="on">7D</button><button>1M</button><button>3M</button></div>} />
        <div className="mono" style={{ fontSize: 26, fontWeight: 700, margin: "2px 0 12px" }}>{claims.length}<span style={{ fontSize: 12.5, color: T.muted, fontWeight: 500 }}> total claims</span></div>
        <div style={{ backgroundImage: "radial-gradient(rgba(35,69,156,.06) 1px,transparent 1px)", backgroundSize: "16px 16px", borderRadius: 10 }}>
          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: "100%", height: 120, display: "block" }}>
            <defs><linearGradient id="ag" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="rgba(35,69,156,.22)" /><stop offset="1" stopColor="rgba(35,69,156,0)" /></linearGradient></defs>
            <path d={area} fill="url(#ag)" />
            <path d={line} fill="none" stroke={T.blue} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
            <circle cx={last[0].toFixed(1)} cy={last[1].toFixed(1)} r={4} fill="#fff" stroke={T.blue} strokeWidth={2.5} />
          </svg>
        </div>
      </div></div>
    </div>
  );
}
