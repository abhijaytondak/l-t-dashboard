// Design tokens (dashboard-collection study): cool-neutral canvas, white cards,
// one brand accent — L&T blue #23459C — over semantic verdict colours.

import type { Verdict, Classification, CheckResult, Confidence, ReviewStatus } from "@lt/shared";

export const T = {
  bg: "#F4F5F7", surface: "#FFFFFF", surface2: "#F8F9FB", sidebar: "#FFFFFF",
  line: "#E8EAED", lineStrong: "#DCE0E6",
  ink: "#16181D", ink2: "#5B6472", muted: "#8A93A2",
  blue: "#23459C", blueHover: "#1B3680", blueTint: "#EAEEF7", blueSoft: "#F3F6FC",
  green: "#167C56", greenBg: "#E7F4EE", greenDot: "#1F9D63",
  amber: "#A9640A", amberBg: "#FBF0DD", amberDot: "#E08A00",
  red: "#C0392B", redBg: "#FBEAE7", redDot: "#DB4437",
  slate: "#6B7382", slateBg: "#EEF0F3", slateDot: "#9AA3B2",
  rSm: 8, rMd: 12, rLg: 16, pill: 999,
  shadow: "0 1px 2px rgba(16,24,40,0.04), 0 1px 3px rgba(16,24,40,0.05)",
  shadowSoft: "0 4px 22px rgba(16,24,40,0.06)",
  shadowMd: "0 10px 30px rgba(16,24,40,0.12)",
  sans: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  mono: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
} as const;

export interface Swatch { fg: string; bg: string; dot: string; label: string; }

export const VERDICT: Record<Verdict, Swatch> = {
  CLEAN: { fg: T.green, bg: T.greenBg, dot: T.greenDot, label: "Approved" },
  PROCESSED_WITH_DEDUCTION: { fg: T.amber, bg: T.amberBg, dot: T.amberDot, label: "Deduction" },
  PUSH_TO_MANUAL: { fg: T.red, bg: T.redBg, dot: T.redDot, label: "Manual" },
};
export const VERDICT_LABEL: Record<Verdict, string> = {
  CLEAN: "Auto-approved",
  PROCESSED_WITH_DEDUCTION: "Processed with deduction",
  PUSH_TO_MANUAL: "Push to manual",
};

export const CLASS: Record<Classification, Swatch> = {
  PAYABLE: { fg: T.green, bg: T.greenBg, dot: T.greenDot, label: "Payable" },
  DISALLOWED: { fg: T.red, bg: T.redBg, dot: T.redDot, label: "Disallowed" },
  ESCALATE: { fg: T.amber, bg: T.amberBg, dot: T.amberDot, label: "Review" },
  NEEDS_REVIEW: { fg: T.amber, bg: T.amberBg, dot: T.amberDot, label: "Review" },
};

export const CONF: Record<Confidence, Swatch> = {
  high: { fg: T.green, bg: T.greenBg, dot: T.greenDot, label: "high" },
  medium: { fg: T.amber, bg: T.amberBg, dot: T.amberDot, label: "medium" },
  low: { fg: T.slate, bg: T.slateBg, dot: T.slateDot, label: "low" },
};

export const REVIEW: Record<ReviewStatus, Swatch> = {
  awaiting: { fg: T.blue, bg: T.blueTint, dot: T.blue, label: "Awaiting" },
  approved: { fg: T.green, bg: T.greenBg, dot: T.greenDot, label: "Approved" },
  cleared: { fg: T.green, bg: T.greenBg, dot: T.greenDot, label: "Auto-cleared" },
  hold: { fg: T.amber, bg: T.amberBg, dot: T.amberDot, label: "On hold" },
  rejected: { fg: T.red, bg: T.redBg, dot: T.redDot, label: "Rejected" },
};

export const CHECK: Record<CheckResult, { fg: string; bg: string; ch: string }> = {
  PASS: { fg: T.green, bg: T.greenBg, ch: "✓" },
  WARN: { fg: T.amber, bg: T.amberBg, ch: "!" },
  FAIL: { fg: T.red, bg: T.redBg, ch: "✕" },
  PENDING: { fg: T.slate, bg: T.slateBg, ch: "·" },
};

export const rupee = (n: number | null | undefined): string =>
  n === null || n === undefined || isNaN(n)
    ? "—"
    : "₹" + Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const rupeeShort = (n: number | null | undefined): string => {
  if (n === null || n === undefined || isNaN(n)) return "₹0";
  const v = Number(n);
  if (v >= 1e7) return "₹" + (v / 1e7).toFixed(2) + "Cr";
  if (v >= 1e5) return "₹" + (v / 1e5).toFixed(2) + "L";
  if (v >= 1e3) return "₹" + (v / 1e3).toFixed(1) + "K";
  return "₹" + v.toLocaleString("en-IN");
};

export const ago = (h: number): string =>
  h < 1 ? "just now" : h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`;
