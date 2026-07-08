// Demo fallback feed — used only when GET /api/claims returns nothing (no
// backend/DB reachable), so the deployed console still renders. Real data always
// wins. A compact builder expands each row into a full ClaimRecord.

import type { ClaimRecord, Verdict, Confidence, Classification } from "@lt/shared";

interface Charge { l: string; a: number; c: Classification; r: string }
interface Row {
  id: string; name: string; ps: string; unit: string; vendor: string; type: string;
  billNo: string; billDate: string; from: string; to: string; gross: number; eligible: number;
  verdict: Verdict; confidence: Confidence; charges: Charge[];
  payment: { s: string; a: number | null; d: string; m: string; match: string };
  notes: string; manual: string[]; sub: number;
}

const inferType = (l: string): string => {
  const s = l.toLowerCase();
  if (/gst|tax/.test(s)) return "GST";
  if (/dth|digital tv/.test(s)) return "BUNDLE_DTH";
  if (/netflix|prime|tune|ott/.test(s)) return "VAS";
  if (/install|one-time|activation|setup|deposit/.test(s)) return "ONE_TIME";
  if (/rental|fiber|broadband|landline|plan/.test(s)) return "RENTAL";
  if (/other/.test(s)) return "OTHER";
  return "OTHER";
};
const catOf = (l: string): string => {
  const s = l.toLowerCase();
  if (/dth|digital tv/.test(s)) return "BUNDLE_NON_COMM";
  if (/netflix|prime|tune|ott/.test(s)) return "VAS_OTT";
  if (/install|one-time|activation|setup|deposit/.test(s)) return "ONE_TIME";
  return "MISC";
};

function make(r: Row): ClaimRecord {
  const manualVerdict = r.verdict === "PUSH_TO_MANUAL";
  const disallowedAmt = r.charges.filter((c) => c.c === "DISALLOWED").reduce((a, c) => a + c.a, 0);
  const payableBase = r.charges.filter((c) => c.c === "PAYABLE" && inferType(c.l) !== "GST").reduce((a, c) => a + c.a, 0);
  const gst = r.charges.filter((c) => c.c === "PAYABLE" && inferType(c.l) === "GST").reduce((a, c) => a + c.a, 0);
  const disallowed = manualVerdict ? null : disallowedAmt;
  const payable = manualVerdict ? null : r.gross - disallowedAmt;
  const disallowances = r.charges.filter((c) => c.c === "DISALLOWED").map((c) => ({ label: c.l, amount: c.a, category: catOf(c.l), reason: c.r }));

  return {
    id: r.id,
    origin: "upload",
    submittedHoursAgo: r.sub,
    review: r.verdict === "CLEAN" ? "cleared" : "awaiting",
    summary: {
      verdict: r.verdict, claimType: r.type, vendor: r.vendor, billDate: r.billDate,
      periodFrom: r.from, periodTo: r.to, grossBillAmount: r.gross,
      totalDisallowed: disallowed, computedPayable: payable, sanctionCapApplied: false,
      disallowedCategories: [...new Set(disallowances.map((d) => d.category))],
      paymentVerified: r.payment.s === "PAID", confidence: r.confidence,
    },
    identity: {
      employeeNameOnBill: r.name, psNumber: r.ps, unit: r.unit, grade: "M2",
      declaredNumber: r.billNo, serviceNumberOnBill: r.billNo, numberMatch: "MATCH",
    },
    billIdentity: {
      billNumber: r.billNo, billDate: r.billDate, periodFrom: r.from, periodTo: r.to,
      accountNumber: r.billNo, connections: 1, consolidated: /black|bundle|dth/i.test(r.notes), planName: r.type,
    },
    charges: r.charges.map((c) => ({
      label: c.l, amount: c.a, type: inferType(c.l), classification: c.c, reason: c.r,
      confidence: r.confidence, source: "detail",
    })),
    disallowances,
    computation: {
      grossBillAmount: r.gross, totalPayableCharges: manualVerdict ? null : payableBase,
      gst: manualVerdict ? null : gst, eligibleLimit: r.eligible, prorationMultiplier: manualVerdict ? null : 1,
      computedPayable: payable, sanctionCapCheck: payable == null ? "PENDING" : payable > r.eligible ? "CAPPED" : "WITHIN",
    },
    paymentVerification: {
      status: r.payment.s, amountPaid: r.payment.a, paymentDate: r.payment.d, mode: r.payment.m,
      reference: "—", matchToBill: r.payment.match,
      matchNote: r.payment.match === "MATCH" ? "Paid amount reconciles to the bill total." : "No payment proof captured.",
    },
    checks: [
      { name: "Active sanction exists", result: "PASS", note: `Sanction ${r.ps} active` },
      { name: "Bill matches sanction number", result: "PASS", note: `${r.billNo} vs declared` },
      { name: "Within eligibility limit", result: payable == null ? "PENDING" : "PASS", note: `limit ₹${r.eligible.toLocaleString("en-IN")}` },
      { name: "All charges allowable", result: manualVerdict ? "FAIL" : disallowedAmt > 0 ? "WARN" : "PASS", note: manualVerdict ? "Unclassifiable line(s)" : disallowedAmt > 0 ? "Some lines stripped" : "All lines classified" },
      { name: "Payment reconciles to bill", result: r.payment.match === "MATCH" ? "PASS" : "PENDING", note: r.payment.match === "MATCH" ? "Paid amount reconciles" : "No payment proof" },
    ],
    routing: { verdict: r.verdict, manualReason: r.manual, auditLog: [] },
    auditVerdict: {
      botStatus: r.verdict === "CLEAN" ? "Auto approved" : r.verdict === "PROCESSED_WITH_DEDUCTION" ? "Processed with deduction" : "Push to Manual",
      exceptionReason: r.manual[0] ?? null,
    },
    _extNotes: r.notes,
  };
}

const P = (s: string, a: number | null, d: string, m: string, match: string) => ({ s, a, d, m, match });

export const SAMPLE_CLAIMS: ClaimRecord[] = [
  make({ id: "CLM-UP-0012", name: "Sourjyo Roy", ps: "LT-204471", unit: "Hydrocarbon", vendor: "AIRTEL", type: "Mobile", billNo: "MF27I2395243", billDate: "2026-06-24", from: "2026-05-23", to: "2026-06-22", gross: 824.82, eligible: 1000, verdict: "CLEAN", confidence: "high", charges: [{ l: "Monthly Rental (Infinity 699)", a: 699, c: "PAYABLE", r: "Recurring plan rental" }, { l: "GST on payable", a: 125.82, c: "PAYABLE", r: "Tax on payable base" }], payment: P("PAID", 824.82, "2026-06-26", "UPI", "MATCH"), notes: "", manual: [], sub: 3 }),
  make({ id: "CLM-UP-0011", name: "Aryan Duhan", ps: "LT-118930", unit: "Power", vendor: "AIRTEL", type: "Broadband", billNo: "AB-99120", billDate: "2026-06-18", from: "2026-05-18", to: "2026-06-17", gross: 1299, eligible: 1200, verdict: "PROCESSED_WITH_DEDUCTION", confidence: "high", charges: [{ l: "Broadband Rental", a: 720, c: "PAYABLE", r: "Recurring broadband rental" }, { l: "GST on broadband", a: 130, c: "PAYABLE", r: "Tax on payable base" }, { l: "Digital TV (DTH)", a: 380, c: "DISALLOWED", r: "Entertainment part of bundle" }, { l: "Netflix add-on", a: 69, c: "DISALLOWED", r: "OTT / VAS" }], payment: P("PAID", 1299, "2026-06-20", "CARD", "MATCH"), notes: "Airtel Black bundle — DTH & OTT split out.", manual: [], sub: 8 }),
  make({ id: "CLM-UP-0010", name: "Ashish Pandey", ps: "LT-256104", unit: "IT", vendor: "VODAFONE", type: "Mobile", billNo: "VI-55210", billDate: "2026-06-10", from: "2026-05-10", to: "2026-06-09", gross: 1540, eligible: 800, verdict: "PUSH_TO_MANUAL", confidence: "low", charges: [{ l: "Multi-connection charges (no itemised page)", a: 1540, c: "ESCALATE", r: "Multiple numbers without breakout" }], payment: P("UNKNOWN", null, "—", "—", "NO_PROOF"), notes: "Vi bill, multiple numbers, no per-line breakout.", manual: ["Unclassifiable line \"Multi-connection charges\" (₹1,540.00) — requires human scrutiny", "Multi-connection billing page missing"], sub: 52 }),
  make({ id: "CLM-UP-0009", name: "Meera Iyer", ps: "LT-330281", unit: "Realty", vendor: "JIO", type: "Broadband", billNo: "JIO-77341", billDate: "2026-06-08", from: "2026-05-08", to: "2026-06-07", gross: 999, eligible: 1000, verdict: "CLEAN", confidence: "high", charges: [{ l: "JioFiber Rental", a: 846, c: "PAYABLE", r: "Recurring broadband rental" }, { l: "GST", a: 153, c: "PAYABLE", r: "Tax on payable base" }], payment: P("PAID", 999, "2026-06-09", "UPI", "MATCH"), notes: "", manual: [], sub: 18 }),
  make({ id: "CLM-UP-0008", name: "Rahul Verma", ps: "LT-207845", unit: "Defence", vendor: "JIO", type: "Mobile", billNo: "JIO-66120", billDate: "2026-06-05", from: "2026-05-05", to: "2026-06-04", gross: 1180, eligible: 900, verdict: "PROCESSED_WITH_DEDUCTION", confidence: "medium", charges: [{ l: "Monthly Rental", a: 799, c: "PAYABLE", r: "Recurring plan rental" }, { l: "GST on rental", a: 143.82, c: "PAYABLE", r: "Tax on payable base" }, { l: "Caller tunes", a: 35, c: "DISALLOWED", r: "VAS" }, { l: "Other charges (Connectivity)", a: 202.18, c: "DISALLOWED", r: "Unspecified other charges" }], payment: P("PAID", 1180, "2026-06-06", "UPI", "MATCH"), notes: "Jio 'Other Charges' inside Connectivity stripped.", manual: [], sub: 30 }),
  make({ id: "CLM-UP-0007", name: "Priya Nair", ps: "LT-441902", unit: "Finance", vendor: "BSNL", type: "Telephone", billNo: "BS-11290", billDate: "2026-06-03", from: "2026-04-03", to: "2026-06-02", gross: 2100, eligible: 1000, verdict: "PUSH_TO_MANUAL", confidence: "medium", charges: [{ l: "Landline rental (2 months)", a: 1780, c: "ESCALATE", r: "Multi-month, proration band unconfirmed" }, { l: "GST", a: 320, c: "ESCALATE", r: "Tax on unresolved base" }], payment: P("UNPAID", null, "—", "—", "NO_PROOF"), notes: "Duplicate-bill layout; >32 day period.", manual: ["Multi-month bill with an unconfirmed proration band", "Duplicate bill layout detected"], sub: 70 }),
  make({ id: "CLM-UP-0006", name: "Karan Mehta", ps: "LT-509233", unit: "Metallurgy", vendor: "AIRTEL", type: "Mobile", billNo: "MF27I8890", billDate: "2026-05-28", from: "2026-04-28", to: "2026-05-27", gross: 649, eligible: 1000, verdict: "CLEAN", confidence: "high", charges: [{ l: "Monthly Rental", a: 550, c: "PAYABLE", r: "Recurring plan rental" }, { l: "GST", a: 99, c: "PAYABLE", r: "Tax on payable base" }], payment: P("PAID", 649, "2026-05-29", "UPI", "MATCH"), notes: "", manual: [], sub: 6 }),
  make({ id: "CLM-UP-0005", name: "Divya Rao", ps: "LT-612077", unit: "Realty", vendor: "HATHWAY", type: "Broadband", billNo: "HW-33110", billDate: "2026-05-24", from: "2026-04-24", to: "2026-05-23", gross: 1450, eligible: 1200, verdict: "PROCESSED_WITH_DEDUCTION", confidence: "high", charges: [{ l: "Broadband Rental", a: 1000, c: "PAYABLE", r: "Recurring broadband rental" }, { l: "GST", a: 180, c: "PAYABLE", r: "Tax on payable base" }, { l: "Installation (one-time)", a: 270, c: "DISALLOWED", r: "One-time charge" }], payment: P("PAID", 1450, "2026-05-25", "CARD", "MATCH"), notes: "", manual: [], sub: 50 }),
  make({ id: "CLM-UP-0004", name: "Sameer Khan", ps: "LT-118004", unit: "Power", vendor: "VODAFONE", type: "Mobile", billNo: "VI-77120", billDate: "2026-05-20", from: "2026-04-20", to: "2026-05-19", gross: 899, eligible: 900, verdict: "CLEAN", confidence: "medium", charges: [{ l: "Monthly Rental", a: 762, c: "PAYABLE", r: "Recurring plan rental" }, { l: "GST", a: 137, c: "PAYABLE", r: "Tax on payable base" }], payment: P("PAID", 899, "2026-05-21", "UPI", "MATCH"), notes: "", manual: [], sub: 22 }),
  make({ id: "CLM-UP-0002", name: "Vikram Singh", ps: "LT-880190", unit: "Defence", vendor: "AIRTEL", type: "Broadband", billNo: "AB-22019", billDate: "2026-05-12", from: "2026-04-12", to: "2026-05-11", gross: 1699, eligible: 1200, verdict: "PROCESSED_WITH_DEDUCTION", confidence: "high", charges: [{ l: "Broadband Rental", a: 900, c: "PAYABLE", r: "Recurring broadband rental" }, { l: "GST", a: 162, c: "PAYABLE", r: "Tax on payable base" }, { l: "Digital TV (DTH)", a: 520, c: "DISALLOWED", r: "Entertainment part of bundle" }, { l: "Amazon Prime", a: 117, c: "DISALLOWED", r: "OTT / VAS" }], payment: P("PAID", 1699, "2026-05-13", "CARD", "MATCH"), notes: "Airtel Black bundle.", manual: [], sub: 44 }),
  make({ id: "CLM-UP-0001", name: "Anita Desai", ps: "LT-990321", unit: "IT", vendor: "BSNL", type: "Telephone", billNo: "BS-55019", billDate: "2026-05-08", from: "2026-04-08", to: "2026-05-07", gross: 560, eligible: 800, verdict: "CLEAN", confidence: "medium", charges: [{ l: "Landline rental", a: 475, c: "PAYABLE", r: "Recurring rental" }, { l: "GST", a: 85, c: "PAYABLE", r: "Tax on payable base" }], payment: P("PAID", 560, "2026-05-09", "CASH", "MATCH"), notes: "", manual: [], sub: 96 }),
];
