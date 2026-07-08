// Claims domain service — the only place that knows the /claims endpoint.
// Verification happens upstream (the employee app POSTs bills to /api/verify);
// this console reads the verified feed.

import { request } from "./apiClient";
import type { ClaimRecord } from "../types/claim";

export const claimsService = {
  /** GET /api/claims → verified ClaimRecords, newest first. */
  getClaims: (): Promise<ClaimRecord[]> => request<ClaimRecord[]>("/api/claims"),
};
