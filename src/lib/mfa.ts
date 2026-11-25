import "server-only";
import * as OTPAuth from "otpauth";
import QRCode from "qrcode";

const ISSUER = "Koshary Ibn El-Omrawy";

function totp(secretBase32: string, label: string) {
  return new OTPAuth.TOTP({
    issuer: ISSUER,
    label,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secretBase32),
  });
}

export function generateTotpSecret(): string {
  return new OTPAuth.Secret({ size: 20 }).base32;
}

export async function buildEnrollment(secretBase32: string, accountLabel: string) {
  const uri = totp(secretBase32, accountLabel).toString();
  const qr = await QRCode.toDataURL(uri, { margin: 1, width: 224, errorCorrectionLevel: "M" });
  return { uri, qr };
}

/**
 * Verifies a 6-digit code (±1 step tolerance) and rejects replays:
 * the matched time-step must be strictly greater than the last accepted step.
 */
export function verifyTotp(secretBase32: string, code: string, lastStep: number): { ok: boolean; step: number } {
  const delta = totp(secretBase32, "admin").validate({ token: code, window: 1 });
  if (delta === null) return { ok: false, step: 0 };
  const step = Math.floor(Date.now() / 1000 / 30) + delta;
  if (step <= lastStep) return { ok: false, step };
  return { ok: true, step };
}

export function currentTotp(secretBase32: string): string {
  return totp(secretBase32, "admin").generate();
}
