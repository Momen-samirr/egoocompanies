/**
 * Driver signup is restricted to Egypt: canonical value for API / Prisma `country`.
 */
export const SIGNUP_COUNTRY_NAME = "Egypt";

const EGYPT_DIAL_CODE = "20";

/**
 * Builds E.164 for Egypt from the national part the user enters (handles leading 0 or pasted +20).
 */
export function buildEgyptSignupPhoneE164(nationalInput: string): string {
  let digits = nationalInput.replace(/\D/g, "");
  if (digits.startsWith(EGYPT_DIAL_CODE)) {
    digits = digits.slice(EGYPT_DIAL_CODE.length);
  }
  if (digits.startsWith("0")) {
    digits = digits.slice(1);
  }
  return `+${EGYPT_DIAL_CODE}${digits}`;
}
