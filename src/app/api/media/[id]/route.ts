import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { storedFiles } from "@/db/schema";
import { api, HttpError } from "@/lib/http";
import { uuidParam, type IdCtx } from "@/lib/params";
import { LOCAL_MEDIA_BUCKET } from "@/lib/storage";

export const dynamic = "force-dynamic";

// Public product / logo / hero images (never receipts). Only re-encoded WebP/JPEG/PNG are stored here.
export const GET = api<IdCtx>(async (_req, ctx) => {
  const id = uuidParam((await ctx.params).id);
  const [file] = await db
    .select()
    .from(storedFiles)
    .where(and(eq(storedFiles.id, id), eq(storedFiles.bucket, LOCAL_MEDIA_BUCKET)))
    .limit(1);
  if (!file) throw new HttpError(404, "غير موجود");
  return new Response(new Uint8Array(file.data), {
    headers: {
      "Content-Type": file.mimeType,
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "Content-Disposition": "inline",
    },
  });
});
