import { audit } from "@/lib/audit";
import { orderViewToken, sha256Hex } from "@/lib/crypto";
import { api, clientIp, clientIpHash, HttpError, json, readMultipart } from "@/lib/http";
import { createOrder } from "@/lib/orders";
import { enforceRateLimit } from "@/lib/rate-limit";
import { getSettings } from "@/lib/settings";
import { putReceipt, removeFile } from "@/lib/storage";
import { requireCaptcha } from "@/lib/turnstile";
import { MAX_MULTIPART_BYTES, validateUpload } from "@/lib/upload";
import { orderPayloadSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Public order endpoint (multipart: `payload` JSON + `receipt` file).
 * Totals, deposit and item prices are computed on the server from database prices —
 * any price/total/status sent by the browser is ignored (unknown keys are stripped by the schema).
 */
export const POST = api(async (req) => {
  const ipHash = clientIpHash(req.headers);
  await enforceRateLimit(`order:ip:${ipHash}`, 10, 3600, "عدد الطلبات من جهازك تجاوز الحد المسموح. حاول لاحقاً.");

  const form = await readMultipart(req, MAX_MULTIPART_BYTES);
  const raw = form.get("payload");
  if (typeof raw !== "string" || raw.length > 20_000) throw new HttpError(400, "بيانات الطلب غير صحيحة");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new HttpError(400, "بيانات الطلب غير صحيحة");
  }
  const payload = orderPayloadSchema.parse(parsed);

  if (payload.website) throw new HttpError(400, "تعذر إرسال الطلب"); // honeypot hit → bot
  await requireCaptcha(payload.turnstileToken, clientIp(req.headers));
  await enforceRateLimit(`order:phone:${sha256Hex(payload.customerPhone)}`, 5, 3600, "تم إرسال عدد كبير من الطلبات بهذا الرقم.");

  const settings = await getSettings();
  if (!settings.ordersEnabled) throw new HttpError(503, settings.ordersClosedMessage);

  const upload = await validateUpload(form.get("receipt"), { allowPdf: true });
  const ref = await putReceipt(upload.buffer, upload.mime, upload.ext);

  try {
    const { orderNumber } = await createOrder(
      payload,
      settings.depositPercentages,
      { ...ref, mime: upload.mime, size: upload.buffer.length, sha256: upload.sha256 },
      ipHash,
    );
    await audit("order.create", {
      entityType: "order",
      entityId: orderNumber,
      metadata: { items: payload.items.length, depositPercent: payload.depositPercent },
      headers: req.headers,
    });
    return json({ orderNumber, token: orderViewToken(orderNumber) }, 201);
  } catch (e) {
    await removeFile(ref); // don't leave orphaned receipts behind
    throw e;
  }
});
