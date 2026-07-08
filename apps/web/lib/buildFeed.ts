import type { ClaimRecord } from "@lt/shared";

// The SSC hand-off payload — the subset of a ClaimRecord L&T's Shared Services
// Centre consumes. Rendered in the drawer's JSON view and by "Export record".
export function buildFeed(claim: ClaimRecord) {
  return {
    record_id: claim.id,
    summary: {
      verdict: claim.summary.verdict,
      employee_ps: claim.identity.psNumber,
      claim_type: claim.summary.claimType,
      vendor: claim.summary.vendor,
      bill_date: claim.summary.billDate,
      bill_period: `${claim.summary.periodFrom} to ${claim.summary.periodTo}`,
      gross_bill_amount: claim.summary.grossBillAmount,
      total_disallowed_amount: claim.summary.totalDisallowed,
      computed_payable_amount: claim.summary.computedPayable,
      disallowed_categories_found: claim.summary.disallowedCategories,
      payment_verified: claim.summary.paymentVerified,
      confidence: claim.summary.confidence,
    },
    identity: {
      declared_number: claim.identity.declaredNumber,
      service_number_on_bill: claim.identity.serviceNumberOnBill,
      number_match: claim.identity.numberMatch,
    },
    disallowances: claim.disallowances.map((d) => ({ label: d.label, amount: d.amount, category: d.category })),
    computation: {
      gross: claim.computation.grossBillAmount,
      payable_charges: claim.computation.totalPayableCharges,
      gst: claim.computation.gst,
      sanction_cap: claim.computation.sanctionCapCheck,
      computed_payable: claim.computation.computedPayable,
    },
    routing: { verdict: claim.routing.verdict, manual_reason: claim.routing.manualReason },
  };
}
