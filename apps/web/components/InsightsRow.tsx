import type { ClaimRecord, Verdict } from "@lt/shared";
import { Icon, T } from "@lt/ui";

// Half-donut arc path helper.
function arc(cx: number, cy: number, r: number, aDeg: number, bDeg: number) {
  const P = (d: number): [number, number] => [cx + r * Math.cos((d * Math.PI) / 180), cy - r * Math.sin((d * Math.PI) / 180)];
  const s = P(aDeg), e = P(bDeg);
  return `M ${s[0].toFixed(1)} ${s[1].toFixed(1)} A ${r} ${r} 0 0 1 ${e[0].toFixed(1)} ${e[1].toFixed(1)}`;
}

function IhHeader({ icon, title, right }: { icon: "barChart" | "gauge" | "trendingUp"; title: string; right?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
      <span className="ihd"><span className="icwrap"><Icon name={icon} size={15} /></span>{title}</span>
      {right}
    </div>
  );
}

export function InsightsRow({ claims }: { claims: ClaimRecord[] }) {
  const tot = claims.length || 1;
  const n = (v: Verdict) => claims.filter((c) => c.summary.verdict === v).length;
  const mix: [string, number, string][] = [
    ["Approved", n("CLEAN"), T.greenDot],
    ["Deduction", n("PROCESSED_WITH_DEDUCTION"), T.amberDot],
    ["Manual", n("PUSH_TO_MANUAL"), T.redDot],
  ];
  const ac = Math.round((n("CLEAN") / tot) * 100);

  // volume: bucket by submitted-day, oldest → newest
  const days = [0, 0, 0, 0, 0, 0, 0];
  claims.forEach((c) => { const d = Math.min(6, Math.floor((c.submittedHoursAgo ?? 0) / 24)); days[d]++; });
  const vol = days.slice().reverse();
  const W = 300, H = 78, mx = Math.max(...vol, 1);
  const pts = vol.map((v, i) => [(i / (vol.length - 1)) * W, H - (v / mx) * (H - 14) - 4] as [number, number]);
  const line = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
  const area = line + ` L ${W} ${H} L 0 ${H} Z`;
  const last = pts[pts.length - 1];
  const f = ac / 100, r = 64, cx = 80, cy = 82, sw = 13;

  return (
    <div style={{ padding: "14px 28px 0" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr 1.4fr", gap: 14 }}>
        {/* verdict mix */}
        <div className="softcard"><div style={{ padding: "16px 18px" }}>
          <IhHeader icon="barChart" title="Verdict mix" right={<span className="mono" style={{ fontSize: 11, color: T.muted }}>{claims.length} total</span>} />
          {mix.map(([l, v, col]) => (
            <div key={l} style={{ marginBottom: 13 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 6 }}><span style={{ color: T.ink2 }}>{l}</span><span className="mono" style={{ color: T.muted }}>{v} · {Math.round((v / tot) * 100)}%</span></div>
              <div style={{ height: 8, background: T.surface2, borderRadius: 999, overflow: "hidden" }}><div style={{ height: "100%", width: `${(v / tot) * 100}%`, background: col, borderRadius: 999 }} /></div>
            </div>
          ))}
        </div></div>

        {/* auto-clear gauge */}
        <div className="softcard"><div style={{ padding: "16px 18px", textAlign: "center" }}>
          <IhHeader icon="gauge" title="Auto-clear rate" />
          <svg viewBox="0 0 160 96" style={{ width: "100%", maxWidth: 190, overflow: "visible", marginTop: 6 }}>
            <defs><linearGradient id="gg" x1="0" x2="1"><stop offset="0" stopColor="#1F9D63" /><stop offset="1" stopColor="#23459C" /></linearGradient></defs>
            <path d={arc(cx, cy, r, 180, 0)} fill="none" stroke={T.surface2} strokeWidth={sw} strokeLinecap="round" />
            <path d={arc(cx, cy, r, 180, 180 - 180 * f)} fill="none" stroke="url(#gg)" strokeWidth={sw} strokeLinecap="round" />
          </svg>
          <div style={{ marginTop: -46 }}><div className="mono" style={{ fontSize: 27, fontWeight: 700 }}>{ac}%</div></div>
          <div style={{ marginTop: 26, fontSize: 11.5, color: T.ink2 }}>{n("CLEAN")} of {claims.length} cleared without a human</div>
        </div></div>

        {/* claims volume */}
        <div className="softcard"><div style={{ padding: "16px 18px 12px" }}>
          <IhHeader icon="trendingUp" title="Claims volume" right={<div className="seg"><button className="on">7D</button><button>1M</button><button>3M</button></div>} />
          <div className="mono" style={{ fontSize: 22, fontWeight: 700, margin: "2px 0 10px" }}>{claims.length}<span style={{ fontSize: 12, color: T.muted, fontWeight: 500 }}> submitted</span></div>
          <div style={{ backgroundImage: "radial-gradient(rgba(35,69,156,.06) 1px,transparent 1px)", backgroundSize: "14px 14px", borderRadius: 10 }}>
            <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: "100%", height: 78, display: "block" }}>
              <defs><linearGradient id="ag" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="rgba(35,69,156,.22)" /><stop offset="1" stopColor="rgba(35,69,156,0)" /></linearGradient></defs>
              <path d={area} fill="url(#ag)" />
              <path d={line} fill="none" stroke={T.blue} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
              <circle cx={last[0].toFixed(1)} cy={last[1].toFixed(1)} r={3.5} fill="#fff" stroke={T.blue} strokeWidth={2.5} />
            </svg>
          </div>
        </div></div>
      </div>
    </div>
  );
}
