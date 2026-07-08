// Shared domain types — mirror the `ClaimRecord` the server returns from
// GET /api/verify & /api/claims (server/src/engine.ts). One contract, imported
// by every app surface via `@lt/shared`.

export type Verdict = "CLEAN" | "PROCESSED_WITH_DEDUCTION" | "PUSH_TO_MANUAL";
export type Classification = "PAYABLE" | "DISALLOWED" | "ESCALATE" | "NEEDS_REVIEW";
export type CheckResult = "PASS" | "WARN" | "FAIL" | "PENDING";
export type NumberMatch = "MATCH" | "MISMATCH" | "NO_REFERENCE";
export type Confidence = "high" | "medium" | "low";

// Human review state layered on top of the engine verdict (reviewer console).
export type ReviewStatus = "awaiting" | "approved" | "hold" | "rejected" | "cleared";

export interface ChargeLine {
  label: string;
  amount: number;
  type: string;
  classification: Classification;
  reason: string;
  confidence: Confidence;
  source: string;
}

export interface Disallowance {
  label: string;
  amount: number;
  category: string;
  reason: string;
}

export interface Check {
  name: string;
  result: CheckResult;
  note: string;
}

export interface ClaimSummary {
  verdict: Verdict;
  claimType: string;
  vendor: string;
  billDate: string;
  periodFrom: string;
  periodTo: string;
  grossBillAmount: number;
  totalDisallowed: number | null;
  computedPayable: number | null;
  sanctionCapApplied: boolean;
  disallowedCategories: string[];
  paymentVerified: boolean;
  confidence: string;
}

export interface ClaimIdentity {
  employeeNameOnBill: string;
  psNumber: string;
  unit: string;
  grade: string;
  declaredNumber: string;
  serviceNumberOnBill: string;
  numberMatch: NumberMatch;
}

export interface BillIdentity {
  billNumber: string;
  billDate: string;
  periodFrom: string;
  periodTo: string;
  accountNumber: string;
  connections: number | null;
  consolidated: boolean;
  planName: string;
}

export interface Computation {
  grossBillAmount: number;
  totalPayableCharges: number | null;
  gst: number | null;
  eligibleLimit: number | null;
  prorationMultiplier: number | null;
  computedPayable: number | null;
  sanctionCapCheck: string;
}

export interface PaymentVerification {
  status: string;
  amountPaid: number | null;
  paymentDate: string;
  mode: string;
  reference: string;
  matchToBill: string;
  matchNote: string;
}

export interface Routing {
  verdict: Verdict;
  manualReason: string[];
  auditLog: string[];
}

export interface AuditVerdict {
  botStatus: string;
  exceptionReason: string | null;
}

export interface ClaimRecord {
  id: string;
  origin: "upload" | "sample";
  summary: ClaimSummary;
  identity: ClaimIdentity;
  billIdentity: BillIdentity;
  charges: ChargeLine[];
  disallowances: Disallowance[];
  computation: Computation;
  paymentVerification: PaymentVerification;
  checks: Check[];
  routing: Routing;
  auditVerdict: AuditVerdict | null;
  _extNotes: string;

  /** Optional metadata the reviewer console layers on (not from the engine). */
  submittedHoursAgo?: number;
  review?: ReviewStatus;
}
