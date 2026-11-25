import { audit } from "@/lib/audit";
import { clearSessionCookie, destroySession, getAuthFromHeaders } from "@/lib/auth";
import { api, json } from "@/lib/http";

export const dynamic = "force-dynamic";

export const POST = api(async (req) => {
  const auth = await getAuthFromHeaders(req.headers);
  if (auth) {
    await destroySession(auth.sessionId);
    await audit("auth.logout", { actorUserId: auth.userId, headers: req.headers });
  }
  return json({ ok: true }, 200, { "Set-Cookie": clearSessionCookie() });
});
