"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ClaimRecord, ClaimStatus } from "@lt/shared";
import { statusOf } from "@lt/shared";
import { Icon, SwatchPill, STATUS, T, rupee } from "@lt/ui";

type Tab = "ALL" | ClaimStatus;
type SortKey = "date" | "name" | "vendor" | "gross" | "disallowed" | "payable" | "status";
type DatePreset = "all" | "this" | "prev" | "custom";

const SO: Record<ClaimStatus, number> = { APPROVED: 0, REJECTED: 1 };
const PAGE = 8;

const DATE_LABEL: Record<DatePreset, string> = {
  all: "All dates", this: "This month", prev: "Previous month", custom: "Custom range",
};
const iso = (y: number, m: number, d: number) => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

// Resolve a preset to a [from, to] bill-date window (YYYY-MM-DD, inclusive).
// billDate strings compare lexicographically, so no Date math is needed downstream.
function dateWindow(preset: DatePreset, from: string, to: string): { from: string | null; to: string | null } | null {
  if (preset === "all") return null;
  if (preset === "custom") return from || to ? { from: from || null, to: to || null } : null;
  const now = new Date();
  const y = now.getFullYear();
  const m = preset === "this" ? now.getMonth() : now.getMonth() - 1;
  const start = new Date(y, m, 1);
  const last = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
  return { from: iso(start.getFullYear(), start.getMonth(), 1), to: iso(start.getFullYear(), start.getMonth(), last) };
}

const SORTS: [SortKey, "asc" | "desc", string][] = [
  ["date", "desc", "Newest bill date (default)"],
  ["date", "asc", "Oldest bill date"],
  ["payable", "desc", "Payable: high → low"],
  ["payable", "asc", "Payable: low → high"],
  ["gross", "desc", "Gross: high → low"],
  ["name", "asc", "Employee A → Z"],
  ["status", "asc", "Status"],
];

function hl(text: string, q: string) {
  if (!q) return text;
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return text;
  return (<>{text.slice(0, i)}<mark>{text.slice(i, i + q.length)}</mark>{text.slice(i + q.length)}</>);
}

interface Props {
  claims: ClaimRecord[];
  tab: Tab;
  onTab: (t: Tab) => void;
  onOpen: (id: string) => void;
}

export function ClaimsTable({ claims, tab, onTab, onOpen }: Props) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ k: SortKey; dir: "asc" | "desc" }>({ k: "date", dir: "desc" });
  const [page, setPage] = useState(1);
  const [fVendor, setFVendor] = useState<Set<string>>(new Set());
  const [fType, setFType] = useState<Set<string>>(new Set());
  const [datePreset, setDatePreset] = useState<DatePreset>("all");
  const [dFrom, setDFrom] = useState("");
  const [dTo, setDTo] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pop, setPop] = useState<"filter" | "sort" | "date" | null>(null);
  const toolRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (toolRef.current && !toolRef.current.contains(e.target as Node)) setPop(null); };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "/" && document.activeElement !== searchRef.current) { e.preventDefault(); searchRef.current?.focus(); }
      if (e.key === "Escape" && query) setQuery("");
    };
    document.addEventListener("click", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("click", onDoc); document.removeEventListener("keydown", onKey); };
  }, [query]);

  useEffect(() => { setPage(1); }, [tab, query, fVendor, fType, datePreset, dFrom, dTo]);

  const dateWin = useMemo(() => dateWindow(datePreset, dFrom, dTo), [datePreset, dFrom, dTo]);

  const counts = useMemo(() => ({
    ALL: claims.length,
    APPROVED: claims.filter((c) => statusOf(c.summary.verdict) === "APPROVED").length,
    REJECTED: claims.filter((c) => statusOf(c.summary.verdict) === "REJECTED").length,
  }), [claims]);

  const uniq = (k: "vendor" | "type") => [...new Set(claims.map((c) => (k === "vendor" ? c.summary.vendor : c.summary.claimType)))];

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = claims.filter((c) => {
      if (tab !== "ALL" && statusOf(c.summary.verdict) !== tab) return false;
      if (fVendor.size && !fVendor.has(c.summary.vendor)) return false;
      if (fType.size && !fType.has(c.summary.claimType)) return false;
      if (dateWin) {
        const bd = c.summary.billDate;
        if (dateWin.from && bd < dateWin.from) return false;
        if (dateWin.to && bd > dateWin.to) return false;
      }
      if (q) {
        const hay = `${c.identity.employeeNameOnBill} ${c.identity.psNumber} ${c.summary.vendor} ${c.summary.claimType} ${c.billIdentity.billNumber}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    const dir = sort.dir === "asc" ? 1 : -1;
    list.sort((a, b) => {
      switch (sort.k) {
        case "date": return a.summary.billDate.localeCompare(b.summary.billDate) * dir;
        case "name": return a.identity.employeeNameOnBill.localeCompare(b.identity.employeeNameOnBill) * dir;
        case "vendor": return a.summary.vendor.localeCompare(b.summary.vendor) * dir;
        case "gross": return (a.summary.grossBillAmount - b.summary.grossBillAmount) * dir;
        case "disallowed": return ((a.summary.totalDisallowed ?? -1) - (b.summary.totalDisallowed ?? -1)) * dir;
        case "payable": return ((a.summary.computedPayable ?? -1) - (b.summary.computedPayable ?? -1)) * dir;
        case "status": return (SO[statusOf(a.summary.verdict)] - SO[statusOf(b.summary.verdict)]) * dir;
        default: return 0;
      }
    });
    return list;
  }, [claims, tab, query, fVendor, fType, dateWin, sort]);

  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const safePage = Math.min(page, pages);
  const start = (safePage - 1) * PAGE;
  const view = rows.slice(start, start + PAGE);
  const q = query.trim();

  const hsort = (k: SortKey) => setSort((s) => s.k === k ? { k, dir: s.dir === "asc" ? "desc" : "asc" } : { k, dir: k === "name" || k === "vendor" || k === "status" ? "asc" : "desc" });
  const arw = (k: SortKey) => (sort.k === k ? (sort.dir === "asc" ? "↑" : "↓") : "↕");
  const toggle = (set: Set<string>, v: string, upd: (s: Set<string>) => void) => { const n = new Set(set); n.has(v) ? n.delete(v) : n.add(v); upd(n); };
  const toggleSel = (id: string) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allShownSelected = view.length > 0 && view.every((c) => selected.has(c.id));

  const clearDate = () => { setDatePreset("all"); setDFrom(""); setDTo(""); };
  const dateChipLabel = datePreset === "custom"
    ? `Date: ${dFrom || "…"} → ${dTo || "…"}`
    : `Date: ${DATE_LABEL[datePreset]}`;

  const nFacets = fVendor.size + fType.size;
  const chips: [string, () => void][] = [];
  if (tab !== "ALL") chips.push([`Status: ${STATUS[tab].label}`, () => onTab("ALL")]);
  if (dateWin) chips.push([dateChipLabel, clearDate]);
  fVendor.forEach((v) => chips.push([`Vendor: ${v}`, () => toggle(fVendor, v, setFVendor)]));
  fType.forEach((v) => chips.push([`Type: ${v}`, () => toggle(fType, v, setFType)]));

  const TABS: [Tab, string][] = [["ALL", "All"], ["APPROVED", "Approved"], ["REJECTED", "Rejected"]];

  return (
    <div style={{ padding: "14px 28px 40px" }}>
      <div className="card" style={{ overflow: "visible" }}>
        {/* toolbar */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, padding: "14px 16px", borderBottom: `1px solid ${T.line}`, flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {TABS.map(([id, label]) => (
              <button key={id} className={`tab ${tab === id ? "on" : ""}`} onClick={() => onTab(id)}>{label} <span className="c">{counts[id]}</span></button>
            ))}
          </div>
          <div ref={toolRef} style={{ display: "flex", alignItems: "center", gap: 10, position: "relative" }}>
            <div className="searchWrap">
              <Icon name="search" size={15} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: T.muted }} />
              <input ref={searchRef} className="search" value={query} placeholder="Search name, PS, vendor…" onChange={(e) => setQuery(e.target.value)} autoComplete="off" />
              {query
                ? <span style={{ position: "absolute", right: 9, top: "50%", transform: "translateY(-50%)", cursor: "pointer", color: T.muted }} onClick={() => { setQuery(""); searchRef.current?.focus(); }}><Icon name="x" size={15} /></span>
                : <span className="kbd" style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)" }}>/</span>}
            </div>
            <div style={{ position: "relative" }}>
              <button className={`btn ${dateWin ? "primary" : ""}`} onClick={() => setPop(pop === "date" ? null : "date")}><Icon name="calendar" size={15} />{datePreset === "all" ? "Date" : DATE_LABEL[datePreset]}</button>
              {pop === "date" && (
                <div className="pop" style={{ right: 0, top: 44, minWidth: 240 }}>
                  <h5>Date of claim</h5>
                  {(["all", "this", "prev", "custom"] as DatePreset[]).map((p) => (
                    <button key={p} className={`sortitem ${datePreset === p ? "on" : ""}`} onClick={() => { setDatePreset(p); if (p !== "custom") setPop(null); }}>{DATE_LABEL[p]}</button>
                  ))}
                  {datePreset === "custom" && (
                    <div style={{ marginTop: 8, display: "grid", gap: 8 }}>
                      <label style={{ fontSize: 11, color: T.muted, display: "grid", gap: 3 }}>From<input type="date" className="search" style={{ padding: "7px 9px" }} value={dFrom} max={dTo || undefined} onChange={(e) => setDFrom(e.target.value)} /></label>
                      <label style={{ fontSize: 11, color: T.muted, display: "grid", gap: 3 }}>To<input type="date" className="search" style={{ padding: "7px 9px" }} value={dTo} min={dFrom || undefined} onChange={(e) => setDTo(e.target.value)} /></label>
                    </div>
                  )}
                  {dateWin && <div style={{ marginTop: 10 }}><button className="btn" style={{ width: "100%", justifyContent: "center" }} onClick={clearDate}>Clear date filter</button></div>}
                </div>
              )}
            </div>
            <div style={{ position: "relative" }}>
              <button className="btn" onClick={() => setPop(pop === "filter" ? null : "filter")}><Icon name="sliders" />Filter {nFacets > 0 && <span className="badge">{nFacets}</span>}</button>
              {pop === "filter" && (
                <div className="pop" style={{ right: 0, top: 44 }}>
                  <h5>Vendor</h5>
                  {uniq("vendor").map((v) => <label key={v} className="chkline"><input type="checkbox" checked={fVendor.has(v)} onChange={() => toggle(fVendor, v, setFVendor)} />{v}</label>)}
                  <div style={{ height: 10 }} /><h5>Claim type</h5>
                  {uniq("type").map((v) => <label key={v} className="chkline"><input type="checkbox" checked={fType.has(v)} onChange={() => toggle(fType, v, setFType)} />{v}</label>)}
                  <div style={{ marginTop: 12 }}><button className="btn" style={{ width: "100%", justifyContent: "center" }} onClick={() => { setFVendor(new Set()); setFType(new Set()); }}>Clear facets</button></div>
                </div>
              )}
            </div>
            <div style={{ position: "relative" }}>
              <button className="btn" onClick={() => setPop(pop === "sort" ? null : "sort")}><Icon name="sort" />Sort</button>
              {pop === "sort" && (
                <div className="pop" style={{ right: 0, top: 44, minWidth: 230 }}>
                  <h5>Sort by</h5>
                  {SORTS.map(([k, d, l]) => <button key={l} className={`sortitem ${sort.k === k && sort.dir === d ? "on" : ""}`} onClick={() => setSort({ k, dir: d })}>{l}</button>)}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* chips */}
        {chips.length > 0 && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", padding: "10px 16px", borderBottom: `1px solid ${T.line}`, alignItems: "center" }}>
            {chips.map(([label, drop], i) => (
              <span key={i} className="pill" onClick={drop} style={{ background: T.surface2, color: T.ink2, border: `1px solid ${T.line}`, cursor: "pointer", fontWeight: 500, padding: "3px 9px", borderRadius: 999, fontSize: 11, display: "inline-flex", alignItems: "center", gap: 4 }}>{label} <Icon name="x" size={11} /></span>
            ))}
            <button className="sortitem" style={{ width: "auto", color: T.blue, fontWeight: 600, padding: "2px 8px" }} onClick={() => { onTab("ALL"); setFVendor(new Set()); setFType(new Set()); clearDate(); }}>Clear all</button>
          </div>
        )}

        {/* bulk bar */}
        {selected.size > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "10px 16px", background: T.blueTint, borderBottom: `1px solid ${T.line}`, fontSize: 13 }}>
            <span style={{ fontWeight: 600, color: T.blue }}>{selected.size} selected</span>
            <button className="btn primary" style={{ padding: "6px 12px" }}><Icon name="download" size={14} /> Export</button>
            <button className="btn" style={{ padding: "6px 12px" }} onClick={() => setSelected(new Set())}>Clear</button>
          </div>
        )}

        {/* table */}
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th style={{ width: 38 }}><input type="checkbox" className="cb" checked={allShownSelected} onChange={(e) => setSelected((s) => { const n = new Set(s); view.forEach((c) => e.target.checked ? n.add(c.id) : n.delete(c.id)); return n; })} /></th>
                <th className={`sortable ${sort.k === "name" ? "act" : ""}`} onClick={() => hsort("name")}>Employee <span className="arw">{arw("name")}</span></th>
                <th className={`sortable ${sort.k === "vendor" ? "act" : ""}`} onClick={() => hsort("vendor")}>Vendor · Type <span className="arw">{arw("vendor")}</span></th>
                <th className={`sortable ${sort.k === "date" ? "act" : ""}`} onClick={() => hsort("date")}>Date of claim <span className="arw">{arw("date")}</span></th>
                <th className={`sortable num ${sort.k === "gross" ? "act" : ""}`} onClick={() => hsort("gross")}>Gross <span className="arw">{arw("gross")}</span></th>
                <th className={`sortable num ${sort.k === "disallowed" ? "act" : ""}`} onClick={() => hsort("disallowed")}>Disallowed <span className="arw">{arw("disallowed")}</span></th>
                <th className={`sortable num ${sort.k === "payable" ? "act" : ""}`} onClick={() => hsort("payable")}>Payable <span className="arw">{arw("payable")}</span></th>
                <th className={`sortable ${sort.k === "status" ? "act" : ""}`} onClick={() => hsort("status")}>Status <span className="arw">{arw("status")}</span></th>
                <th style={{ width: 34 }} />
              </tr>
            </thead>
            <tbody>
              {view.length === 0 ? (
                <tr><td colSpan={9} style={{ textAlign: "center", color: T.muted, padding: 40 }}>{q ? `No claims match “${q}”.` : "No claims match these filters."}</td></tr>
              ) : view.map((c) => {
                const s = STATUS[statusOf(c.summary.verdict)];
                return (
                  <tr key={c.id} className={selected.has(c.id) ? "sel" : ""} onClick={() => onOpen(c.id)}>
                    <td style={{ borderLeft: `3px solid ${s.dot}` }} onClick={(e) => e.stopPropagation()}><input type="checkbox" className="cb" checked={selected.has(c.id)} onChange={() => toggleSel(c.id)} /></td>
                    <td><div style={{ fontWeight: 600 }}>{hl(c.identity.employeeNameOnBill, q)}</div><div className="mono" style={{ fontSize: 11, color: T.muted }}>{hl(c.identity.psNumber, q)}</div></td>
                    <td><div style={{ fontWeight: 500 }}>{hl(c.summary.vendor, q)}</div><div style={{ fontSize: 11.5, color: T.muted }}>{c.summary.claimType}</div></td>
                    <td><div style={{ fontSize: 12.5, color: T.ink2 }}>{c.summary.billDate}</div></td>
                    <td className="num">{rupee(c.summary.grossBillAmount)}</td>
                    <td className="num" style={{ color: c.summary.totalDisallowed ? T.red : T.muted }}>{c.summary.totalDisallowed ? "−" + rupee(c.summary.totalDisallowed) : "—"}</td>
                    <td className="num" style={{ fontWeight: 700, color: c.summary.computedPayable == null ? T.muted : T.ink }}>{c.summary.computedPayable == null ? "—" : rupee(c.summary.computedPayable)}</td>
                    <td><SwatchPill swatch={s} size="sm" /></td>
                    <td style={{ textAlign: "center", color: T.muted }}><Icon name="chevronRight" size={15} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* footer */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderTop: `1px solid ${T.line}`, fontSize: 12.5, color: T.ink2 }}>
          <span>Showing {rows.length ? start + 1 : 0}–{Math.min(start + PAGE, rows.length)} of {rows.length}</span>
          <div style={{ display: "flex", gap: 6 }}>
            <button className="btn" style={{ padding: "5px 10px" }} disabled={safePage === 1} onClick={() => setPage(safePage - 1)}>‹</button>
            {Array.from({ length: pages }, (_, i) => i + 1).map((p) => <button key={p} className={`btn ${p === safePage ? "primary" : ""}`} style={{ padding: "5px 11px" }} onClick={() => setPage(p)}>{p}</button>)}
            <button className="btn" style={{ padding: "5px 10px" }} disabled={safePage === pages} onClick={() => setPage(safePage + 1)}>›</button>
          </div>
        </div>
      </div>
    </div>
  );
}
