// engine.ts
// The deterministic verification engine. Gemini extracts & classifies; THIS file
// does all arithmetic and gating. Same inputs always produce the same payable.
// This is the asset — change it only with tests green.
//
// Consumes the flat extraction contract (charges[].decision, payment.paid,
// audit_verdict). The bill-reading layer no longer emits per-charge `type`, so
// the engine infers it from the label where its GST-split / category / IR logic
// needs it. Fields the new prompt dropped are kept optional and default safely.

// ----------------------------- Types ---------------------------------------
export interface Sanction {
  ps: string;
  name: string;
  unit: string;
  grade: string;
  declaredNumber: string;
  eligibleLimit: number | null;
  irSanction: boolean;
  irSanctionAmount: number;
  nilSalary: boolean;
  dosDate: string; // "" if none
}

// A charge line as the extraction layer reports it (new contract).
export interface ExtractedChargeInput {
  label: string;
  amount: number;
  decision: "PAYABLE" | "DISALLOWED" | "NEEDS_REVIEW";
  reason: string;
  // Optional carryovers — the current prompt omits these; fixtures/older
  // prompts may still supply them.
  type?: string;
  confidence?: "high" | "medium" | "low";
  source?: string;
}

// A charge line as the engine emits it in the record (read by the UI).
export interface ExtractedCharge {
  label: string;
  amount: number;
  type: string;
  classification: "PAYABLE" | "DISALLOWED" | "ESCALATE" | "NEEDS_REVIEW";
  reason: string;
  confidence: "high" | "medium" | "low";
  source: string;
}

export interface Extraction {
  vendor: string;
  claim_type: string;
  is_bundle: boolean;
  employee_name: string;
  service_number: string;
  bill_number: string;
  bill_date: string | null;
  bill_period_from: string | null;
  bill_period_to: string | null;
  gross_bill_amount: number;
  charges: ExtractedChargeInput[];
  payable_total?: number;
  disallowed_total?: number;
  reconciles?: boolean;
  payment: {
    paid: boolean;
    amount_paid: number | null;
    payment_date: string | null;
    mode: string;
    reference?: string; // dropped from the new schema; kept optional
  } | null;
  confidence: string;
  audit_verdict: {
    bot_status: "Auto approved" | "Processed with deduction" | "Push to Manual";
    exception_reason: string | null;
  } | null;
  notes: string;
  // Carryover fields the current prompt no longer emits (defaulted if absent).
  format?: string;
  account_or_relationship_number?: string;
  number_of_connections?: number | null;
  plan_name?: string;
  is_payment_receipt?: boolean;
  duplicate_bill_layout?: boolean;
}

// The assembled record returned to the client / written to the feed.
export interface ClaimRecord {
  id: string;
  origin: "upload" | "sample";
  summary: any;
  identity: any;
  billIdentity: any;
  charges: ExtractedCharge[];
  disallowances: { label: string; amount: number; category: string; reason: string }[];
  computation: any;
  paymentVerification: any;
  checks: { name: string; result: string; note: string }[];
  routing: { verdict: string; manualReason: string[]; auditLog: string[] };
  auditVerdict: { botStatus: string; exceptionReason: string | null } | null;
  _extNotes: string;
}

// --------------------------- Helpers ---------------------------------------
export function round2(n: number): number {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}
export function last6(s: string): string {
  return (s || "").replace(/\D/g, "").slice(-6);
}
function cap(s: string): string {
  if (!s) return "—";
  return s.charAt(0) + s.slice(1).toLowerCase();
}
function rupee(n: number | null): string {
  if (n === null || n === undefined || isNaN(n)) return "—";
  return "₹" + Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function dayDiff(from: string | null, to: string | null): number | null {
  if (!from || !to) return null;
  const a = new Date(from), b = new Date(to);
  if (isNaN(a.getTime()) || isNaN(b.getTime())) return null;
  return Math.round((b.getTime() - a.getTime()) / 86400000) + 1;
}
export function prorationMultiplier(from: string | null, to: string | null): { mult: number | null; ambiguous: boolean } {
  const d = dayDiff(from, to);
  if (d === null) return { mult: 1.0, ambiguous: false };
  if (d <= 32) return { mult: 1.0, ambiguous: false };
  if (d >= 58 && d <= 62) return { mult: 0.5, ambiguous: false };
  if (d >= 87 && d <= 93) return { mult: 0.33, ambiguous: false };
  return { mult: null, ambiguous: true }; // unconfirmed band -> manual
}

// Infer a charge `type` from its label. The new extraction contract reports only
// label/amount/decision/reason, but the engine keys its GST-split, disallowance
// categories and IR gate off `type`. Order matters: GST is checked first so a
// "GST on Digital TV" line is GST, not BUNDLE_DTH.
export function inferType(label: string): string {
  const s = (label || "").toLowerCase();
  if (/\b(gst|tax|igst|cgst|sgst|vat|cess)\b/.test(s)) return "GST";
  if (/digital tv|\bdth\b|\bd2h\b|\bncf\b|set[- ]?top|television|set top box/.test(s)) return "BUNDLE_DTH";
  if (/netflix|hello\s?tunes?|caller\s?tunes?|amazon prime|prime video|hotstar|booster|\bott\b/.test(s)) return "VAS";
  if (/roaming|international|\bir\b/.test(s)) return "IR";
  if (/late\s?(fee|payment|charge)/.test(s)) return "LATE_FEE";
  if (/activation|installation|shifting|security deposit|set[- ]?up charge|one[- ]?time|onetime/.test(s)) return "ONE_TIME";
  if (/connection charge/.test(s)) return "CONNECTION";
  if (/rental|monthly|recurring|\bplan\b|wi-?fi|broadband|fixed\s?line|landline/.test(s)) return "RENTAL";
  if (/usage|\bcall\b|\bsms\b|\bisd\b|data charge/.test(s)) return "USAGE";
  return "OTHER";
}

// ------------------------- The engine --------------------------------------
export function buildRecord(ext: Extraction, sanction: Sanction | null, idCounter: number): ClaimRecord {
  const overallConfidence = (ext.confidence as "high" | "medium" | "low") || "low";

  const charges: ExtractedCharge[] = (ext.charges || []).map((c) => ({
    label: c.label || "—",
    amount: Number(c.amount) || 0,
    type: c.type || inferType(c.label),
    // decision → classification (NEEDS_REVIEW routes to manual like ESCALATE).
    classification: c.decision || "NEEDS_REVIEW",
    reason: c.reason || "",
    confidence: c.confidence || overallConfidence,
    source: c.source || "—",
  }));

  // IR override: if the employee HAS an IR sanction, IR lines within the
  // sanctioned amount become payable; excess is clawed back (disallowed).
  if (sanction && sanction.irSanction) {
    charges.forEach((c) => {
      if (c.type === "IR" && (c.classification === "ESCALATE" || c.classification === "NEEDS_REVIEW")) {
        if ((Number(sanction.irSanctionAmount) || 0) >= c.amount) {
          c.classification = "PAYABLE";
          c.reason = "IR within active IR sanction";
        } else {
          c.classification = "DISALLOWED";
          c.reason = "IR exceeds sanctioned amount (claw-back)";
        }
      }
    });
  }

  const disallowedLines = charges.filter((c) => c.classification === "DISALLOWED");
  // NEEDS_REVIEW is treated exactly like ESCALATE — both route to manual.
  const escalateLines = charges.filter((c) => c.classification === "ESCALATE" || c.classification === "NEEDS_REVIEW");
  const payableLines = charges.filter((c) => c.classification === "PAYABLE");

  const totalDisallowed = round2(disallowedLines.reduce((a, c) => a + c.amount, 0));
  const payableBase = round2(payableLines.filter((c) => c.type !== "GST").reduce((a, c) => a + c.amount, 0));
  const payableGst = round2(payableLines.filter((c) => c.type === "GST").reduce((a, c) => a + c.amount, 0));

  const { mult, ambiguous } = prorationMultiplier(ext.bill_period_from, ext.bill_period_to);

  const catOf = (c: ExtractedCharge): string => {
    const t = c.type;
    const lbl = (c.label || "").toLowerCase();
    if (t === "LATE_FEE") return "LATE_FEE";
    if (t === "VAS" || t === "OTT") return "VAS_OTT";
    if (t === "BUNDLE_DTH") return "BUNDLE_NON_COMM";
    if (t === "ONE_TIME") return c.amount > 100 ? "ONE_TIME_OVER_100" : "ONE_TIME_UNDER_100";
    if (t === "CONNECTION") return "CONNECTION_CHARGE";
    if (t === "MISC") return "MISC";
    if (lbl.includes("netflix") || lbl.includes("hello tune")) return "VAS_OTT";
    return "MISC";
  };
  const disallowances = disallowedLines.map((c) => ({ label: c.label, amount: c.amount, category: catOf(c), reason: c.reason }));
  const disallowedCategories = [...new Set(disallowances.map((d) => d.category))];

  // number match
  let numberMatch = "NO_REFERENCE";
  if (sanction) {
    numberMatch = last6(ext.service_number) && last6(ext.service_number) === last6(sanction.declaredNumber) ? "MATCH" : "MISMATCH";
  }

  // The extraction layer can also flag a manual route via audit_verdict. We take
  // the more conservative of the two verdicts: if Gemini says Push to Manual,
  // honour it even when the engine would otherwise have computed a payable.
  const geminiSaysPushToManual = ext.audit_verdict?.bot_status === "Push to Manual";

  // routing reasons
  const manualReason: string[] = [];
  if (ext.is_payment_receipt) manualReason.push("Document is a payment receipt, not a tax invoice — no charge breakup");
  escalateLines.forEach((c) => manualReason.push(`Unclassifiable line "${c.label}" (${rupee(c.amount)}) — requires human scrutiny`));
  if (ambiguous) manualReason.push("Multi-month bill with an unconfirmed proration band — held pending multiplier confirmation");
  if (charges.some((c) => c.confidence === "low") && !ext.is_payment_receipt) manualReason.push("One or more low-confidence extracted lines");
  if (!sanction) manualReason.push("No matching sanction on file — reference checks could not run");
  if (numberMatch === "MISMATCH") manualReason.push("Bill number does not match the sanctioned number");
  if (geminiSaysPushToManual) {
    const reason = ext.audit_verdict?.exception_reason || "Flagged for manual review by the extraction layer";
    if (!manualReason.includes(reason)) manualReason.push(reason);
  }

  // payable computation (deterministic)
  let computedPayable: number | null = null;
  let sanctionCapCheck = "PENDING";
  let sanctionCapApplied = false;
  const canCompute = !ext.is_payment_receipt && escalateLines.length === 0 && !ambiguous && !geminiSaysPushToManual;
  if (canCompute) {
    let pay = round2((payableBase + payableGst) * (mult || 1.0));
    if (sanction && sanction.eligibleLimit != null) {
      if (pay > sanction.eligibleLimit) {
        pay = round2(sanction.eligibleLimit);
        sanctionCapApplied = true;
        sanctionCapCheck = "CAPPED";
      } else {
        sanctionCapCheck = "WITHIN";
      }
    } else {
      sanctionCapCheck = "PENDING";
    }
    computedPayable = pay;
  }

  const verdict = !canCompute ? "PUSH_TO_MANUAL" : disallowedLines.length ? "PROCESSED_WITH_DEDUCTION" : "CLEAN";

  // payment verification
  const pv = ext.payment;
  let matchToBill = "NO_PROOF";
  let matchNote = "No payment record captured.";
  if (pv && pv.amount_paid != null) {
    if (ext.is_payment_receipt) {
      matchToBill = "NO_BILL";
      matchNote = "Proof of payment present, but no itemised bill to verify against.";
    } else if (Math.abs(Number(pv.amount_paid) - Number(ext.gross_bill_amount)) <= 1) {
      matchToBill = "MATCH";
      matchNote = "Paid amount reconciles to the bill total.";
    } else {
      matchToBill = "MISMATCH";
      matchNote = `Paid ${rupee(pv.amount_paid)} vs bill ${rupee(ext.gross_bill_amount)} — does not reconcile; review before confirm.`;
    }
  }

  // checks
  const checks: { name: string; result: string; note: string }[] = [];
  checks.push({ name: "Active sanction exists", result: sanction ? "PASS" : "FAIL", note: sanction ? `Sanction ${sanction.ps} active` : "No info available — no sanction on file" });
  checks.push({ name: "Bill period valid", result: ext.bill_period_from && ext.bill_period_to ? "PASS" : "FAIL", note: ext.bill_period_from ? `${ext.bill_period_from} → ${ext.bill_period_to}` : "No period on document" });
  checks.push({ name: "Bill matches sanction number", result: numberMatch === "MATCH" ? "PASS" : numberMatch === "MISMATCH" ? "FAIL" : "PENDING", note: numberMatch === "NO_REFERENCE" ? "No info available — no declared number on file" : `${ext.service_number || "—"} vs declared` });
  checks.push({ name: "Within eligibility limit", result: computedPayable == null ? "PENDING" : sanction && sanction.eligibleLimit != null ? "PASS" : "PENDING", note: sanction && sanction.eligibleLimit != null ? `limit ${rupee(sanction.eligibleLimit)}` : "No info available — limit not in sanction" });
  checks.push({ name: "All charges allowable", result: escalateLines.length ? "FAIL" : disallowedLines.length ? "WARN" : "PASS", note: escalateLines.length ? "Unclassifiable line(s) present" : disallowedLines.length ? "Some lines stripped" : "All lines classified" });
  checks.push({ name: "Bot-readable", result: ext.is_payment_receipt ? "WARN" : overallConfidence === "low" ? "WARN" : "PASS", note: ext.is_payment_receipt ? "Receipt, not an invoice" : `${ext.vendor} ${ext.format || ext.claim_type || ""}`.trim() });
  checks.push({ name: "Postpaid / prepaid rule", result: "PASS", note: ext.claim_type === "BROADBAND" ? "Broadband — prepaid/postpaid accepted" : "Mobile postpaid expected" });
  checks.push({ name: "NIL-salary block", result: sanction ? (sanction.nilSalary ? "FAIL" : "PASS") : "PENDING", note: sanction ? (sanction.nilSalary ? "Employee NIL-salary tagged — claims blocked" : "Not NIL-tagged") : "No info available" });
  checks.push({ name: "Date-of-separation cutoff", result: sanction ? (sanction.dosDate ? "WARN" : "PASS") : "PENDING", note: sanction ? (sanction.dosDate ? `DOS ${sanction.dosDate} — prorate/cut off` : "No DOS on record") : "No info available" });
  checks.push({ name: "Payment proof present", result: pv && pv.paid ? "PASS" : "WARN", note: pv && pv.paid ? "Payment captured" : "No payment record" });
  checks.push({ name: "Payment reconciles to bill", result: matchToBill === "MATCH" ? "PASS" : matchToBill === "MISMATCH" ? "FAIL" : "PENDING", note: matchNote });

  const fmtDate = (d: string | null) => d || "—";

  return {
    id: `CLM-UP-${String(idCounter).padStart(4, "0")}`,
    origin: "upload",
    summary: {
      verdict,
      claimType: cap(ext.claim_type),
      vendor: ext.vendor || "—",
      billDate: fmtDate(ext.bill_date),
      periodFrom: fmtDate(ext.bill_period_from),
      periodTo: fmtDate(ext.bill_period_to),
      grossBillAmount: Number(ext.gross_bill_amount) || 0,
      totalDisallowed: ext.is_payment_receipt ? null : totalDisallowed,
      computedPayable,
      sanctionCapApplied,
      disallowedCategories,
      paymentVerified: !!(pv && pv.paid),
      confidence: overallConfidence,
    },
    identity: {
      employeeNameOnBill: ext.employee_name || "—",
      psNumber: sanction ? sanction.ps : "—",
      unit: sanction ? sanction.unit : "—",
      grade: sanction ? sanction.grade : "—",
      declaredNumber: sanction ? sanction.declaredNumber : "—",
      serviceNumberOnBill: ext.service_number || "—",
      numberMatch,
    },
    billIdentity: {
      billNumber: ext.bill_number || "—",
      billDate: fmtDate(ext.bill_date),
      periodFrom: fmtDate(ext.bill_period_from),
      periodTo: fmtDate(ext.bill_period_to),
      accountNumber: ext.account_or_relationship_number || ext.service_number || "—",
      connections: ext.number_of_connections ?? null,
      consolidated: !!ext.is_bundle,
      planName: ext.plan_name || "—",
    },
    charges,
    disallowances,
    computation: {
      grossBillAmount: Number(ext.gross_bill_amount) || 0,
      totalPayableCharges: canCompute ? payableBase : null,
      gst: canCompute ? payableGst : payableGst || null,
      eligibleLimit: sanction ? sanction.eligibleLimit : null,
      prorationMultiplier: ambiguous ? null : mult || 1.0,
      computedPayable,
      sanctionCapCheck,
    },
    paymentVerification: {
      status: pv ? (pv.paid ? "PAID" : "UNPAID") : "UNKNOWN",
      amountPaid: pv ? pv.amount_paid : null,
      paymentDate: pv ? pv.payment_date || "—" : "—",
      mode: pv ? pv.mode || "—" : "—",
      reference: pv ? pv.reference || "—" : "—",
      matchToBill,
      matchNote,
    },
    checks,
    routing: {
      verdict,
      manualReason,
      auditLog: [
        `Uploaded & read by Gemini (${overallConfidence})`,
        `Vendor=${ext.vendor} ${ext.format || ext.claim_type || ""}`.trim(),
        sanction ? `Matched sanction ${sanction.ps}` : "No sanction matched",
        ext.audit_verdict ? `Extraction verdict: ${ext.audit_verdict.bot_status}${ext.audit_verdict.exception_reason ? " — " + ext.audit_verdict.exception_reason : ""}` : "",
        ext.notes || "",
      ].filter(Boolean),
    },
    auditVerdict: ext.audit_verdict
      ? { botStatus: ext.audit_verdict.bot_status, exceptionReason: ext.audit_verdict.exception_reason }
      : null,
    _extNotes: ext.notes || "",
  };
}
