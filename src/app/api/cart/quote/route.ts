import { api, clientIpHash, json, readJson } from "@/lib/http";
import { enforceRateLimit } from "@/lib/rate-limit";
import { quoteCart } from "@/lib/orders";
import { quoteSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

// Returns authoritative prices from the database for the items in a cart.
export const POST = api(async (req) => {
  await enforceRateLimit(`quote:${clientIpHash(req.headers)}`, 120, 600);
  const { items } = quoteSchema.parse(await readJson(req, 8 * 1024));
  const q = await quoteCart(items);
  return json(q);
});
