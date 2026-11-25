// Browser-side helper for calling our JSON / multipart API routes.
export type ApiResult<T> =
  | { ok: true; data: T; status: number }
  | { ok: false; error: string; status: number; fields?: string[] };

export async function apiRequest<T = Record<string, unknown>>(
  url: string,
  init: { method?: string; json?: unknown; form?: FormData } = {},
): Promise<ApiResult<T>> {
  try {
    const res = await fetch(url, {
      method: init.method ?? (init.json || init.form ? "POST" : "GET"),
      headers: init.json !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: init.form ?? (init.json !== undefined ? JSON.stringify(init.json) : undefined),
      credentials: "same-origin",
      cache: "no-store",
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        error: typeof data.error === "string" ? data.error : "حدث خطأ. حاول مرة أخرى.",
        fields: Array.isArray(data.fields) ? (data.fields as string[]) : undefined,
      };
    }
    return { ok: true, data: data as T, status: res.status };
  } catch {
    return { ok: false, status: 0, error: "تعذر الاتصال بالخادم. تحقق من الإنترنت." };
  }
}
