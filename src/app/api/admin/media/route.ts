import { audit } from "@/lib/audit";
import { authApi, can } from "@/lib/auth";
import { api, HttpError, json, readMultipart } from "@/lib/http";
import { enforceRateLimit } from "@/lib/rate-limit";
import { putMedia } from "@/lib/storage";
import { MAX_MULTIPART_BYTES, reencodeImage, validateUpload } from "@/lib/upload";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Admin image upload (products / logo / hero). Images are validated, then RE-ENCODED to WebP.
export const POST = api(async (req) => {
  const auth = await authApi(req);
  if (!can(auth.role, "products.manage") && !can(auth.role, "settings.manage")) {
    throw new HttpError(403, "ليست لديك صلاحية لهذا الإجراء");
  }
  await enforceRateLimit(`media:${auth.userId}`, 60, 3600);
  const form = await readMultipart(req, MAX_MULTIPART_BYTES);
  const upload = await validateUpload(form.get("file"), { allowPdf: false });
  const webp = await reencodeImage(upload.buffer, 1600);
  const url = await putMedia(webp, "image/webp", "webp");
  await audit("media.upload", { actorUserId: auth.userId, entityType: "media", metadata: { bytes: webp.length }, headers: req.headers });
  return json({ url }, 201);
});
