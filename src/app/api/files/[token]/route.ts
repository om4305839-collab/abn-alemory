import { audit } from "@/lib/audit";
import { authApi } from "@/lib/auth";
import { api, HttpError } from "@/lib/http";
import { readLocalFile, verifyFileToken } from "@/lib/storage";

export const dynamic = "force-dynamic";

/**
 * Private receipt download (database storage driver).
 * Requires BOTH a valid admin session with `receipts.read` AND an unexpired HMAC-signed token.
 */
export const GET = api<{ params: Promise<{ token: string }> }>(async (req, ctx) => {
  const auth = await authApi(req, { permission: "receipts.read" });
  const ref = verifyFileToken((await ctx.params).token);
  if (!ref) throw new HttpError(403, "الرابط غير صالح أو منتهي الصلاحية");
  const file = await readLocalFile(ref);
  if (!file) throw new HttpError(404, "غير موجود");
  await audit("receipt.download", { actorUserId: auth.userId, entityType: "receipt", headers: req.headers });
  return new Response(new Uint8Array(file.data), {
    headers: {
      "Content-Type": file.mimeType,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
      "Content-Disposition": `inline; filename="receipt.${file.mimeType.split("/")[1]?.replace("jpeg", "jpg") ?? "bin"}"`,
    },
  });
});
