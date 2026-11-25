import "server-only";
import { hash, verify } from "@node-rs/argon2";

// Argon2id (library default algorithm) with OWASP-recommended minimum cost parameters.
const OPTIONS = { memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

export const hashPassword = (password: string) => hash(password, OPTIONS);

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}

let dummyHash: Promise<string> | null = null;

/** Burn comparable CPU time when the account doesn't exist (prevents user enumeration by timing). */
export async function dummyVerify(password: string): Promise<void> {
  dummyHash ??= hashPassword("ka-dummy-password-for-timing-equalisation");
  await verifyPassword(await dummyHash, password);
}

/** Returns an Arabic message describing why a password is unacceptable, or null when it is fine. */
export function passwordPolicyProblem(pw: string, email: string): string | null {
  if (pw.length < 14) return "كلمة المرور يجب ألا تقل عن 14 حرفاً";
  if (pw.length > 256) return "كلمة المرور طويلة جداً";
  const lower = pw.toLowerCase();
  if (["password", "12345678", "qwerty", "admin", "koshary", "kushari", "omrawy"].some((w) => lower.includes(w)))
    return "كلمة المرور تحتوي كلمة أو تسلسلاً شائعاً";
  const local = email.split("@")[0].toLowerCase();
  if (local.length >= 3 && lower.includes(local)) return "يجب ألا تحتوي كلمة المرور على اسم البريد الإلكتروني";
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(pw)).length;
  if (classes < 3) return "استخدم 3 أنواع على الأقل من: أحرف صغيرة، أحرف كبيرة، أرقام، رموز";
  return null;
}
