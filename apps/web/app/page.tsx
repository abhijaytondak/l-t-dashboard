"use client";
import { useCallback, useEffect, useState } from "react";
import type { ClaimRecord, ClaimStatus, ReviewStatus } from "@lt/shared";
import { claimsService, safeApiCall } from "@lt/shared";
import { T } from "@lt/ui";
import { Sidebar } from "../components/Sidebar";
import { Topbar } from "../components/Topbar";
import { KpiRow } from "../components/KpiRow";
import { InsightsRow } from "../components/InsightsRow";
import { ClaimsTable } from "../components/ClaimsTable";
import { ClaimDrawer } from "../components/ClaimDrawer";
import { SAMPLE_CLAIMS } from "../lib/sampleClaims";

type Tab = "ALL" | ClaimStatus;
const POLL_MS = 15000;

export default function Page() {
  const [claims, setClaims] = useState<ClaimRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<Tab>("ALL");
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

  const drawerClaim = claims.find((c) => c.id === drawerId) ?? null;

  return (
    <div style={{ display: "flex", alignItems: "flex-start", minHeight: "100vh" }}>
      <Sidebar />
      <main style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", minHeight: "100vh" }}>
        <Topbar onRefresh={() => load(true)} refreshing={refreshing} />
        <KpiRow claims={claims} onPick={setTab} />
        <InsightsRow claims={claims} />
        <ClaimsTable
          claims={claims}
          tab={tab}
          onTab={setTab}
          onOpen={setDrawerId}
        />
        {loading && <div style={{ padding: "0 28px 40px", color: T.muted, fontSize: 13 }}>Loading claims…</div>}
      </main>

      <ClaimDrawer claim={drawerClaim} onClose={() => setDrawerId(null)} onAct={act} />
    </div>
  );
}
