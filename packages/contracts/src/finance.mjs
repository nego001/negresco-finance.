export const PaymentStatus = Object.freeze({
  CREATED:'CREATED', AWAITING_AUTHORIZATION:'AWAITING_AUTHORIZATION',
  PROCESSING:'PROCESSING', SETTLED:'SETTLED', FAILED:'FAILED',
  CANCELLED:'CANCELLED', UNKNOWN:'UNKNOWN'
});
export const IntegrationMode = Object.freeze({
  MOCK:'mock', SANDBOX:'sandbox', PENDING_APPROVAL:'pending_approval', LIVE:'live'
});
export function validatePixDraft(draft) {
  if (!draft || !Number.isSafeInteger(draft.amountMinor) || draft.amountMinor<=0) return {valid:false,reason:'INVALID_AMOUNT'};
  if (draft.currency!=='BRL') return {valid:false,reason:'INVALID_CURRENCY'};
  if (typeof draft.recipientKey!=='string' || !draft.recipientKey.trim()) return {valid:false,reason:'MISSING_RECIPIENT'};
  if (typeof draft.idempotencyKey!=='string' || draft.idempotencyKey.length<12) return {valid:false,reason:'MISSING_IDEMPOTENCY'};
  return {valid:true,reason:'VALID'};
}
