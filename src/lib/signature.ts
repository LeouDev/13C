/** Shared signature rules — the database enforces the same (contract_signatures_signature_png). */
export const SIGNATURE_PNG = /^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/;
export const MAX_SIGNATURE_CHARS = 400_000;

export const isValidSignatureImage = (s: unknown): s is string =>
  typeof s === "string" && s.length <= MAX_SIGNATURE_CHARS && SIGNATURE_PNG.test(s);

/** "a1b2c3d4e5…" → "a1b2c3d4 e5f6…" so a SHA-256 wraps cleanly on screen and in the PDF. */
export const groupFingerprint = (hex: string, size = 8) => hex.match(new RegExp(`.{1,${size}}`, "g"))?.join(" ") ?? hex;
