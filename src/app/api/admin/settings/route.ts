import { audit } from "@/lib/audit";
import { authApi } from "@/lib/auth";
import { api, json, readJson } from "@/lib/http";
import { saveSettings } from "@/lib/settings";
import { settingsPatchSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export const PUT = api(async (req) => {
  const auth = await authApi(req, { permission: "settings.manage" });
  const patch = settingsPatchSchema.parse(await readJson(req));
  const changed = await saveSettings(patch);
  await audit("settings.update", {
    actorUserId: auth.userId,
    entityType: "settings",
    metadata: { changed: changed.join(",") },
    headers: req.headers,
  });
  return json({ ok: true, changed });
});
