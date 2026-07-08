"use client";
import { useCallback, useEffect, useState } from "react";
import type { ClaimRecord, ReviewStatus, Verdict } from "@lt/shared";
import { claimsService, safeApiCall } from "@lt/shared";
import { Icon, T } from "@lt/ui";
import { Sidebar } from "../components/Sidebar";
import { Topbar } from "../components/Topbar";
import { KpiRow } from "../components/KpiRow";
import { InsightsRow } from "../components/InsightsRow";
import { ClaimsTable } from "../components/ClaimsTable";
import { ClaimDrawer } from "../components/ClaimDrawer";
import { SAMPLE_CLAIMS } from "../lib/sampleClaims";

type Tab = "ALL" | Verdict;
const POLL_MS = 15000;

export default function Page() {
  const [claims, setClaims] = useState<ClaimRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<Tab>("ALL");
  const [attention, setAttention] = useState(false);
  const [drawerId, setDrawerId] = useState<string | null>(null);

  const load = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    const { data } = await safeApiCall(claimsService.getClaims);
    // Real feed wins; fall back to the demo feed when the backend is unreachable/empty.
    setClaims(data && data.length ? data : SAMPLE_CLAIMS);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(() => load(true), POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  const act = (id: string, status: ReviewStatus) =>
    setClaims((cs) => cs.map((c) => (c.id === id ? { ...c, review: status } : c)));
  const bulkApprove = (ids: string[]) =>
    setClaims((cs) => cs.map((c) => (ids.includes(c.id) && c.review !== "cleared" && c.summary.computedPayable != null ? { ...c, review: "approved" as ReviewStatus } : c)));

  const awaiting = claims.filter((c) => (c.review ?? "awaiting") === "awaiting").length;
  const drawerClaim = claims.find((c) => c.id === drawerId) ?? null;

  return (
    <div style={{ display: "flex", alignItems: "flex-start", minHeight: "100vh" }}>
      <Sidebar />
      <main style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", minHeight: "100vh" }}>
        <Topbar onRefresh={() => load(true)} refreshing={refreshing} />
        <KpiRow claims={claims} onPick={(t) => { setTab(t); setAttention(false); }} />

        {awaiting > 0 && (
          <div style={{ padding: "6px 28px 0" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14, background: T.blueSoft, border: "1px solid rgba(35,69,156,.18)", borderRadius: 12, padding: "12px 16px" }}>
              <span style={{ width: 36, height: 36, borderRadius: 10, background: T.blueTint, display: "inline-flex", alignItems: "center", justifyContent: "center", color: T.blue }}><Icon name="bell" size={18} /></span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: T.blue }}>{awaiting} claim{awaiting > 1 ? "s" : ""} awaiting your review</div>
                <div style={{ fontSize: 12, color: T.ink2 }}>Exceptions the bot couldn&apos;t auto-clear — deductions and manual holds waiting on you.</div>
              </div>
              <button className={attention ? "btn" : "btn primary"} onClick={() => { setAttention((a) => !a); setTab("ALL"); }}>{attention ? "✓ Showing queue" : "Review queue →"}</button>
            </div>
          </div>
        )}

        <InsightsRow claims={claims} />
        <ClaimsTable
          claims={claims}
          tab={tab}
          attention={attention}
          onTab={(t) => { setTab(t); setAttention(false); }}
          onClearAttention={() => setAttention(false)}
          onOpen={setDrawerId}
          onBulkApprove={bulkApprove}
        />
        {loading && <div style={{ padding: "0 28px 40px", color: T.muted, fontSize: 13 }}>Loading claims…</div>}
      </main>

      <ClaimDrawer claim={drawerClaim} onClose={() => setDrawerId(null)} onAct={act} />
    </div>
  );
}
