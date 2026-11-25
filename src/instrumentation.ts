export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  try {
    const { ensureAppSecret, ensureDemoData } = await import("./lib/bootstrap");
    await ensureAppSecret();
    await ensureDemoData();
  } catch (e) {
    // never crash the server because of bootstrap; log a short, non-sensitive message
    console.error("[bootstrap]", e instanceof Error ? e.message.slice(0, 200) : "unknown error");
  }
}
