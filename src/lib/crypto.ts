import "server-only";
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  hkdfSync,
  randomBytes,
  randomInt,
  timingSafeEqual,
} from "node:crypto";
import { appSecret, hasPersistentSecret } from "./env";

export const sha256Hex = (v: string | Buffer) => createHash("sha256").update(v).digest("hex");

export const randomToken = (bytes = 32) => randomBytes(bytes).toString("base64url");

/** HKDF sub-key per purpose so one leaked derived key never exposes the others. */
function subKey(purpose: string): Buffer {
  return Buffer.from(hkdfSync("sha256", appSecret(), "ka-salt-v1", `ka:${purpose}`, 32));
}

export function hmacB64(purpose: string, data: string): string {
  return createHmac("sha256", subKey(purpose)).update(data).digest("base64url");
}

/** Constant-time string comparison (hash first so length differences don't leak). */
export function safeEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

/** AES-256-GCM. Format: v1.<iv>.<tag>.<ciphertext> (base64url). */
export function encryptSecret(plain: string): string {
  if (!hasPersistentSecret()) throw new Error("APP_SECRET must be configured to store MFA secrets");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", subKey("mfa"), iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", iv.toString("base64url"), tag.toString("base64url"), ct.toString("base64url")].join(".");
}

export function decryptSecret(token: string): string {
  const [v, iv, tag, ct] = token.split(".");
  if (v !== "v1" || !iv || !tag || !ct) throw new Error("bad ciphertext");
  const decipher = createDecipheriv("aes-256-gcm", subKey("mfa"), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ct, "base64url")), decipher.final()]).toString("utf8");
}

/** Keyed hash of an IP: lets us rate-limit and audit without storing raw IPs. */
export const hashIp = (ip: string) => hmacB64("ip", ip).slice(0, 24);

const ORDER_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export function randomOrderNumber(): string {
  let s = "";
  for (let i = 0; i < 8; i++) s += ORDER_ALPHABET[randomInt(ORDER_ALPHABET.length)];
  return `KA-${s}`;
}

/** Stateless token that lets a customer view their own order page (no PII on that page). */
export const orderViewToken = (orderNumber: string) => hmacB64("order-view", orderNumber).slice(0, 24);
export const verifyOrderViewToken = (orderNumber: string, token: string) =>
  safeEqual(orderViewToken(orderNumber), token);
