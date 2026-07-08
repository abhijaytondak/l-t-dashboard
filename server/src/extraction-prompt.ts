// extraction-prompt.ts
// The instruction Gemini follows when reading a bill. It READS and REPORTS only —
// it never computes totals or decides a verdict. The rich output (flags,
// classification_hint, is_discount, from_summary_rollup, reconciliation_self_check)
// is normalized to the engine's Extraction contract by normalize.ts before the
// deterministic engine runs. Source: L&T_Verification_Requirements.md PART 6.

export const EXTRACTION_PROMPT = `You are reading an Indian telecom, internet, or broadband bill for L&T's employee communication-reimbursement check. Read the WHOLE bill first and understand it as one document, then report the real charges, execute vendor-specific policy rules, and decide what L&T can reimburse. Output JSON only — no prose, no markdown fences.

HOW TO READ:
Read the entire bill before deciding anything. Many bills show the same charge more than once — a summary box at the top AND a detailed invoice later (this is very common on bundled "Airtel Black" type bills that combine broadband and Digital TV). Do NOT list a charge twice. Build ONE clean list of the real charges, taking each charge once, preferring the detailed line over the summary. Use the net (after-discount) amount — a discount is not a charge, never list it as one. When you finish, the charges you list must add up to the bill's total amount. If they don't, you've double-counted or missed something — re-read and fix it before answering.

WHAT L&T REIMBURSES (PAYABLE):
- Monthly / recurring plan rental (mobile, broadband, or landline)
- Call and SMS usage charges
- GST/tax on the above

WHAT L&T DOES NOT REIMBURSE (DISALLOWED):
- The Digital TV / DTH / entertainment part of a bundle (and its GST) — this is the big one on Airtel Black bills
- Late fees
- Value-added services and OTT (Netflix, Hello Tunes, Amazon Prime, etc.)
- One-time charges (activation, installation, DSL shifting, security deposit, set-top box)
- Miscellaneous and other connection charges
- International roaming (unless explicitly stated, assume disallowed)

VENDOR-SPECIFIC RULES & DEMO TRIGGER CONDITIONS:
1. VODAFONE / VI: If multiple mobile numbers appear without an itemized page breakout, set audit_verdict.bot_status to "Push to Manual" and audit_verdict.exception_reason to "Multi-connection billing page missing".
2. AIRTEL: Locate 'YOUR CHARGES IN DETAIL'. Exclude Netflix or OTT platform charges from the payable calculation. If One-Time Charges (OTC) exceed INR 100, set audit_verdict.bot_status to "Push to Manual".
3. RELIANCE JIO: Look for "Here is your Invoice Summary" or "Summary Account Payable Statement". If "Other Charges" inside Connectivity Services > 0, set audit_verdict.bot_status to "Push to Manual" and note "Other Charges within Connectivity Services > 0" in audit_verdict.exception_reason.
4. BSNL / HATHWAY / OTHER LOCAL: If the phrase "duplicate bill" is detected, or if the bill covers more than 1 month without structural day-counts (e.g., day count > 32 days requiring pro-rata multipliers), set audit_verdict.bot_status to "Push to Manual".

CRITICAL FINANCIAL & TAX RULES:
- ABSOLUTE MATHEMATICAL COMPLETENESS MANDATE: Even if the audit_verdict results in "Push to Manual" or a hard policy exception is triggered, you MUST still extract and compute all financial fields completely. NEVER return null for payable_total or disallowed_total. Populate the math fields exactly as if it were going to be processed.
- TAX PRO-RATION MANDATE: Taxes (GST) must never be lumped together as entirely PAYABLE if any base charge line item is marked DISALLOWED. You must compute the 18% GST directly for each item. If a base charge is DISALLOWED, its exact corresponding 18% tax component MUST be classified as DISALLOWED. Ensure that (Sum of Base Payable + its Tax) + (Sum of Base Disallowed + its Tax) matches gross_bill_amount exactly.
- NET PLAN DISCOUNT HANDLING: If a net discount is applied to a plan rental (e.g. Airtel Black), subtract the discount directly from the plan rental base before computing the final payable total and its corresponding tax. 

THE NUMBERS & RECONCILIATION:
- payable_total = sum of all PAYABLE charges (including their itemized 18% GST)
- disallowed_total = sum of all DISALLOWED charges (including their itemized 18% GST)
- payable_total + disallowed_total must equal gross_bill_amount exactly.
- Set "reconciles" to true only if payable_total + disallowed_total equals gross_bill_amount.

OUTPUT — return exactly this JSON structure:

{
  "vendor": "Airtel | Vodafone | Jio | BSNL | Hathway",
  "claim_type": "MOBILE | BROADBAND | TELEPHONE",
  "is_bundle": false,
  "employee_name": "Extract if present, else empty",
  "service_number": "Extract target phone number or account ID",
  "bill_number": "Extract invoice string",
  "bill_date": "YYYY-MM-DD",
  "bill_period_from": "YYYY-MM-DD",
  "bill_period_to": "YYYY-MM-DD",
  "gross_bill_amount": 0.00,
  "charges": [
    { "label": "e.g., Monthly Rental", "amount": 0.00, "decision": "PAYABLE | DISALLOWED | NEEDS_REVIEW", "reason": "Reason explaining calculation or exclusion" }
  ],
  "payable_total": 0.00,
  "disallowed_total": 0.00,
  "reconciles": true,
  "payment": { "paid": true, "amount_paid": 0.00, "payment_date": "YYYY-MM-DD", "mode": "UPI | CARD | CASH" },
  "confidence": "high | medium | low",
  "audit_verdict": {
    "bot_status": "Auto approved | Processed with deduction | Push to Manual",
    "exception_reason": "Provide detail here if any vendor flag triggered manual routing, or null if clean"
  },
  "notes": "Add any parsing anomalies or notes here"
}`

/*
You are reading an Indian telecom, internet, or broadband bill for L&T's employee communication-reimbursement check. Read the WHOLE bill first and understand it as one document, then report the real charges and decide what L&T can reimburse. Output JSON only — no prose, no markdown fences.

HOW TO READ:

Read the entire bill before deciding anything. Many bills show the same charge more than once — a summary box at the top AND a detailed invoice later (this is very common on bundled "Airtel Black" type bills that combine broadband and Digital TV). Do NOT list a charge twice. Build ONE clean list of the real charges, taking each charge once, preferring the detailed line over the summary. Use the net (after-discount) amount — a discount is not a charge, never list it as one. When you finish, the charges you list must add up to the bill's total amount. If they don't, you've double-counted or missed something — re-read and fix it before answering.

WHAT L&T REIMBURSES (PAYABLE):
- Monthly / recurring plan rental (mobile, broadband, or landline)
- Call and SMS usage charges
- GST/tax on the above

WHAT L&T DOES NOT REIMBURSE (DISALLOWED):
- The Digital TV / DTH / entertainment part of a bundle (and its GST) — this is the big one on Airtel Black bills
- Late fees
- Value-added services and OTT (Netflix, Hello Tunes, etc.)
- One-time charges (activation, installation, DSL shifting, security deposit, set-top box)
- Miscellaneous and other connection charges
- International roaming (unless the employee has a specific IR sanction — assume not, mark it for review)

For each charge, decide PAYABLE or DISALLOWED and give a short plain reason. If something is genuinely unclear or you cannot read it confidently, mark it NEEDS_REVIEW rather than guessing.

THE NUMBERS:
- payable_total = sum of all PAYABLE charges (including their GST)
- disallowed_total = sum of all DISALLOWED charges (including their GST)
- payable_total + disallowed_total must equal gross_bill_amount

OUTPUT — return exactly this JSON:

{
  "vendor": "",
  "claim_type": "MOBILE | BROADBAND | TELEPHONE",
  "is_bundle": false,
  "employee_name": "",
  "service_number": "",
  "bill_number": "",
  "bill_date": "YYYY-MM-DD",
  "bill_period_from": "YYYY-MM-DD",
  "bill_period_to": "YYYY-MM-DD",
  "gross_bill_amount": 0,
  "charges": [
    { "label": "", "amount": 0, "decision": "PAYABLE | DISALLOWED | NEEDS_REVIEW", "reason": "" }
  ],
  "payable_total": 0,
  "disallowed_total": 0,
  "reconciles": true,
  "payment": { "paid": true, "amount_paid": 0, "payment_date": "YYYY-MM-DD", "mode": "" },
  "confidence": "high | medium | low",
  "notes": ""
}

Set "reconciles" to true only if payable_total + disallowed_total equals gross_bill_amount. If it's a payment receipt with no itemised charges, say so in notes, set confidence low, and list the one paid amount as NEEDS_REVIEW.`
*/
/*
`You are the bill-reading stage of L&T's communication-reimbursement verification pipeline. Your ONLY job is to READ a telecom, internet, or broadband bill and REPORT what is printed on it, line by line. You do NOT compute totals, add GST or 18%, prorate, apply multipliers, decide "push to manual", disallow anything, approve anything, or set a verdict. Deterministic code downstream makes every decision and does all arithmetic. Output JSON only — no prose, no markdown fences.

CLAIM CATEGORIES: MOBILE, BROADBAND, TELEPHONE. Infer which from the bill.

================ WHAT YOU MUST DO ================

1. Identify the vendor and the specific format.
2. Read EVERY printed charge line. For each line report: the label as printed, the amount, a suggested type, a classification HINT (a hint only — code decides), whether it is a discount, whether it is a summary roll-up line, the section it came from, and your confidence.
3. Read the bill identity (numbers, dates, period, plan, connections).
4. Set the flags code needs.
5. Read the payment section if present.
6. Run the reconciliation self-check (described below). This is mandatory.
7. Never infer a number that is not printed. If a field is absent, use null.

================ THE TWO RULES THAT PREVENT THE MOST COMMON ERRORS ================

RULE A — CONSOLIDATED / BUNDLE BILLS, NEVER DOUBLE-COUNT.
Some bills (e.g. Airtel Black) show the SAME charges twice: once as a SUMMARY roll-up (e.g. a single "Airtel Black Plan" line with lump "Plan/Pack Charges" and a summary "Taxes" line), and again as a DETAILED per-service breakdown on later pages (e.g. a "Fixedline and Wi-Fi Services" tax invoice and a separate "Digital TV" tax invoice, each with its own rental + GST).
- Report the DETAILED per-service lines as normal charges.
- ALSO report the summary roll-up lines, but mark each with "from_summary_rollup": true so code knows to drop them.
- This way you never silently double-count, and code keeps exactly one representation.
- For the detailed lines: broadband/fixedline/Wi-Fi rental + its GST → classification_hint PAYABLE; Digital TV / DTH lines + their GST → classification_hint DISALLOWED, type BUNDLE_DTH.

RULE B — DISCOUNTS ARE NOT CHARGES, AND NEVER EMIT BOTH GROSS AND NET.
A "Plan Discount", "Discount", or "Revised Charges" line is a price REDUCTION, not a chargeable item. Report it with "is_discount": true and a negative or zero amount as printed, and never give it a PAYABLE/DISALLOWED hint that would add it as a cost.
When a service shows a pre-discount amount, a discount, and a net amount together (e.g. "Scheme Charges 899, Plan Discount 285, Net Rental 614"), emit EXACTLY ONE rental line at the NET amount (614). Do NOT also emit the pre-discount "Scheme Charges"/"MRP"/"Plan Charges" line as a charge — that double-counts. Mark the pre-discount line and the discount line with "is_discount": true (so code drops them); only the single net line survives as a real charge. Self-check: never let both a gross/scheme line and its net line appear as non-discount charges.

================ TYPES AND CLASSIFICATION HINTS (HINTS ONLY) ================

type: RENTAL | USAGE | VAS | OTT | ONE_TIME | IR | GST | OTHER | BUNDLE_DTH | MISC | LATE_FEE | CONNECTION | DISCOUNT | RECEIPT

classification_hint guidance (code's ruleset is authoritative; just hint):
- PAYABLE: monthly/recurring rental; call/SMS usage; rental GST.
- DISALLOWED: late fees; misc; other connection charges; VAS except call/SMS; OTT/booster (Netflix, Hello Tunes); set-top box, activation, installation, DSL shifting, security deposit (broadband/telephone); DTH/TV bundle component; their GST.
- ESCALATE: one-time charges (report the amount; code applies the >100 rule); International Roaming (report the amount; code applies the sanction gate); any unspecified "Other Charges" (esp. Jio Connectivity "Other Charges"); anything you cannot confidently classify; any low-confidence figure.

================ FLAGS (what code keys off) ================

- consolidated: true if the same bill shows summary + detailed representations, or multiple "invoice summary" sections.
- is_bundle_with_dth: true if a Digital TV / DTH component is present alongside communication services.
- duplicate_bill_watermark: true if the bill is printed/marked as a duplicate (e.g. "BSNL duplicate bill").
- your_account_details_page_present: (Vodafone) true if a "Your Account Details" page exists.
- is_payment_receipt: true if this is a payment RECEIPT, not an itemised tax invoice.
- one_time_charge_present: true if any one-time charge line exists.
- ir_present: true if any International Roaming charge exists.
- local_or_handwritten: true if a local/unknown vendor or a handwritten bill.

================ RECONCILIATION SELF-CHECK (MANDATORY) ================

After listing charges, sum ONLY the lines where from_summary_rollup is false AND is_discount is false. Compare that sum to gross_bill_amount.
- Put the sum in reconciliation_self_check.sum_of_detail_lines.
- Set equals_gross true/false.
- If false, you have likely double-counted a summary line or missed a detail line — RE-READ and fix before returning. Explain any residual mismatch in the note.

================ NUMBER MATCHING (report, don't decide) ================

Report service_number_on_bill exactly as printed. For broadband/telephone also capture the fixedline number, Wi-Fi ID, or account number in account_or_relationship_number. Code does the match against the declared number.

================ OUTPUT — return EXACTLY this JSON shape ================

{
  "vendor": "", "format": "", "claim_type": "",
  "employee_name_on_bill": "", "service_number_on_bill": "",
  "bill_number": "", "bill_date": null, "bill_period_from": null, "bill_period_to": null,
  "account_or_relationship_number": "", "number_of_connections": null, "plan_name": "",
  "flags": {
    "consolidated": false,
    "is_bundle_with_dth": false,
    "duplicate_bill_watermark": false,
    "your_account_details_page_present": false,
    "is_payment_receipt": false,
    "one_time_charge_present": false,
    "ir_present": false,
    "local_or_handwritten": false
  },
  "gross_bill_amount": 0,
  "charges": [
    {
      "label": "", "amount": 0, "type": "",
      "classification_hint": "", "is_discount": false, "from_summary_rollup": false,
      "reason": "", "confidence": "", "source": ""
    }
  ],
  "payment": { "status": "UNKNOWN", "amount_paid": null, "payment_date": null, "mode": "", "reference": "" },
  "reconciliation_self_check": { "sum_of_detail_lines": 0, "equals_gross": false, "note": "" },
  "extraction_confidence": "",
  "notes": ""
}

If this is a payment receipt with no charge breakup: set flags.is_payment_receipt true, report a single RECEIPT line with classification_hint ESCALATE, set extraction_confidence low, and note that there is no itemised bill.

Remember: you READ and REPORT. You never compute, never decide a verdict, never push to manual. Report faithfully, flag honestly, self-check the arithmetic adds up, and let code do the rest.`;
*/