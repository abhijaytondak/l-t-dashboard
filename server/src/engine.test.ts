// engine.test.ts
// Regression locks. These outcomes must never silently change.
// Run with: npx vitest run
//
// If you change engine.ts and one of these fails, the change is wrong
// (or you must consciously update the expected value).
//
// Fixtures use the flat extraction contract: charges[].decision (PAYABLE |
// DISALLOWED | NEEDS_REVIEW), payment.paid, and audit_verdict.

import { describe, it, expect } from "vitest";
import { buildRecord, Extraction, Sanction } from "./engine";

const sanctionFor = (declaredNumber: string, over: Partial<Sanction> = {}): Sanction => ({
  ps: "LT-TEST", name: "Test", unit: "Unit", grade: "G1",
  declaredNumber, eligibleLimit: 5000, irSanction: false, irSanctionAmount: 0,
  nilSalary: false, dosDate: "", ...over,
});

// ---- Fixture 1: Airtel mobile with a Hello Tunes VAS line -> 824.82 --------
const airtelMobile: Extraction = {
  vendor: "AIRTEL", claim_type: "MOBILE", is_bundle: false,
  employee_name: "Sourjyo Roy", service_number: "7838514344",
  bill_number: "MF2707I002395243", bill_date: "2026-05-24",
  bill_period_from: "2026-04-23", bill_period_to: "2026-05-22",
  gross_bill_amount: 842.52,
  charges: [
    { label: "Monthly Rental (Infinity Family 699)", amount: 699.0, decision: "PAYABLE", reason: "Recurring plan rental" },
    { label: "VAS - Hello Tunes download", amount: 15.0, decision: "DISALLOWED", reason: "VAS" },
    { label: "GST on payable charges", amount: 125.82, decision: "PAYABLE", reason: "Tax on payable base" },
    { label: "GST on VAS", amount: 2.7, decision: "DISALLOWED", reason: "Tax on disallowed line" },
  ],
  payable_total: 824.82, disallowed_total: 17.7, reconciles: true,
  payment: { paid: true, amount_paid: 824.83, payment_date: "2026-05-02", mode: "UPI" },
  confidence: "high",
  audit_verdict: { bot_status: "Processed with deduction", exception_reason: null },
  notes: "",
};

// ---- Fixture 2: Airtel Black bundle -> broadband 724.52, DTH disallowed ----
const airtelBlack: Extraction = {
  vendor: "AIRTEL", claim_type: "BROADBAND", is_bundle: true,
  employee_name: "Aryan Duhan", service_number: "20035210793",
  bill_number: "HF2706I001509122", bill_date: "2026-05-12",
  bill_period_from: "2026-04-11", bill_period_to: "2026-05-10",
  gross_bill_amount: 1060.82,
  charges: [
    { label: "Broadband - Fixedline + WiFi rental", amount: 614.0, decision: "PAYABLE", reason: "Broadband rental" },
    { label: "GST on broadband", amount: 110.52, decision: "PAYABLE", reason: "Tax on payable" },
    { label: "Digital TV - Black Hindi Ultimate Plus HD", amount: 284.19, decision: "DISALLOWED", reason: "DTH" },
    { label: "Digital TV - NCF", amount: 0.81, decision: "DISALLOWED", reason: "DTH NCF" },
    { label: "GST on Digital TV", amount: 51.3, decision: "DISALLOWED", reason: "Tax on DTH" },
  ],
  payable_total: 724.52, disallowed_total: 336.3, reconciles: true,
  payment: { paid: true, amount_paid: 1060.82, payment_date: "2026-04-22", mode: "CARD" },
  confidence: "high",
  audit_verdict: { bot_status: "Processed with deduction", exception_reason: null },
  notes: "",
};

// ---- Fixture 3: Jio mobile with unspecified Other Charges -> manual --------
const jioMobile: Extraction = {
  vendor: "JIO", claim_type: "MOBILE", is_bundle: false,
  employee_name: "Ashish Pandey", service_number: "9599949488",
  bill_number: "338525326096", bill_date: "2026-05-07",
  bill_period_from: "2026-04-06", bill_period_to: "2026-05-05",
  gross_bill_amount: 706.82,
  charges: [
    { label: "Monthly Plan Charges", amount: 449.0, decision: "PAYABLE", reason: "Rental" },
    { label: "Other Charges (unspecified)", amount: 150.0, decision: "NEEDS_REVIEW", reason: "Unspecified Jio Other Charges" },
    { label: "GST", amount: 107.82, decision: "PAYABLE", reason: "Tax" },
  ],
  payable_total: 556.82, disallowed_total: 0, reconciles: true,
  payment: { paid: true, amount_paid: 706.82, payment_date: "2026-05-01", mode: "UPI" },
  confidence: "medium",
  audit_verdict: { bot_status: "Push to Manual", exception_reason: "Other Charges in Connectivity Services > 0" },
  notes: "",
};

// ---- Fixture 4: payment receipt only -> manual ----------------------------
const receiptOnly: Extraction = {
  vendor: "AIRTEL", claim_type: "MOBILE", is_bundle: false,
  employee_name: "Suchin Narnappa Kotian", service_number: "09167555227",
  bill_number: "Receipt 1423007543", bill_date: null, bill_period_from: null, bill_period_to: null,
  gross_bill_amount: 1657.9,
  charges: [
    { label: "Paid amount (receipt only)", amount: 1657.9, decision: "NEEDS_REVIEW", reason: "Receipt not invoice" },
  ],
  payable_total: 0, disallowed_total: 0, reconciles: true,
  payment: { paid: true, amount_paid: 1657.9, payment_date: "2026-06-02", mode: "CARD" },
  confidence: "low",
  audit_verdict: { bot_status: "Push to Manual", exception_reason: "Payment receipt with no itemised charges" },
  notes: "",
  is_payment_receipt: true,
};

describe("verification engine — regression locks", () => {
  it("Airtel mobile: strips Hello Tunes VAS, pays 824.82", () => {
    const r = buildRecord(airtelMobile, sanctionFor("7838514344"), 1);
    expect(r.summary.verdict).toBe("PROCESSED_WITH_DEDUCTION");
    expect(r.summary.computedPayable).toBe(824.82);
    expect(r.summary.totalDisallowed).toBe(17.7);
    expect(r.summary.disallowedCategories).toContain("VAS_OTT");
  });

  it("Airtel Black bundle: strips DTH, pays broadband 724.52", () => {
    const r = buildRecord(airtelBlack, sanctionFor("20035210793"), 2);
    expect(r.summary.verdict).toBe("PROCESSED_WITH_DEDUCTION");
    expect(r.summary.computedPayable).toBe(724.52);
    expect(r.summary.totalDisallowed).toBe(336.3);
    expect(r.summary.disallowedCategories).toContain("BUNDLE_NON_COMM");
  });

  it("Jio mobile: unspecified Other Charges -> push to manual", () => {
    const r = buildRecord(jioMobile, sanctionFor("9599949488"), 3);
    expect(r.summary.verdict).toBe("PUSH_TO_MANUAL");
    expect(r.summary.computedPayable).toBeNull();
  });

  it("Payment receipt only -> push to manual", () => {
    const r = buildRecord(receiptOnly, null, 4);
    expect(r.summary.verdict).toBe("PUSH_TO_MANUAL");
    expect(r.summary.computedPayable).toBeNull();
  });

  it("Sanction cap: payable capped at eligibility limit", () => {
    const r = buildRecord(airtelMobile, sanctionFor("7838514344", { eligibleLimit: 800 }), 5);
    expect(r.summary.computedPayable).toBe(800);
    expect(r.summary.sanctionCapApplied).toBe(true);
  });

  it("No sanction: reference checks PENDING/FAIL, still routes to manual", () => {
    const r = buildRecord(airtelMobile, null, 6);
    expect(r.identity.numberMatch).toBe("NO_REFERENCE");
    expect(r.routing.manualReason.some((m) => m.includes("No matching sanction"))).toBe(true);
  });

  it("audit_verdict Push to Manual is honoured and its reason surfaces", () => {
    // Jio fixture: engine would already manual via NEEDS_REVIEW, but the
    // Gemini exception_reason must also be merged into manualReason.
    const r = buildRecord(jioMobile, sanctionFor("9599949488"), 7);
    expect(r.summary.verdict).toBe("PUSH_TO_MANUAL");
    expect(r.routing.manualReason.some((m) => m.includes("Other Charges in Connectivity Services"))).toBe(true);
    expect(r.auditVerdict?.botStatus).toBe("Push to Manual");
  });

  it("audit_verdict Push to Manual overrides an otherwise-clean bill", () => {
    // A fully-payable, reconciling bill that the extraction layer flagged: the
    // conservative merge must still route it to manual.
    const flagged: Extraction = {
      ...airtelMobile,
      charges: [
        { label: "Monthly Rental", amount: 699.0, decision: "PAYABLE", reason: "rental" },
        { label: "GST", amount: 125.82, decision: "PAYABLE", reason: "tax" },
      ],
      gross_bill_amount: 824.82,
      audit_verdict: { bot_status: "Push to Manual", exception_reason: "Multi-connection billing page missing" },
    };
    const r = buildRecord(flagged, sanctionFor("7838514344"), 8);
    expect(r.summary.verdict).toBe("PUSH_TO_MANUAL");
    expect(r.summary.computedPayable).toBeNull();
    expect(r.routing.manualReason.some((m) => m.includes("Multi-connection billing page missing"))).toBe(true);
  });
});
