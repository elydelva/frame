export interface WorktreeClaim {
  protocolVersion: 1;
  claimId: string;
  issueId: string;
  actor: string;
  branch: string;
  path: string;
  createdAt: string;
}

export type ClaimStoreErrorCode =
  | "INVALID_CLAIM"
  | "UNSUPPORTED_CLAIM_PROTOCOL"
  | "CLAIM_LOCK_TIMEOUT";

export interface ClaimStoreErrorInfo {
  code: ClaimStoreErrorCode;
  path: string;
  message: string;
}

export interface WorktreeClaimEntry {
  issueId: string;
  path: string;
  claim: WorktreeClaim | null;
  error: ClaimStoreErrorInfo | null;
}
