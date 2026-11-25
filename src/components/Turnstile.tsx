"use client";
import { useEffect, useRef } from "react";

type TurnstileApi = {
  render: (el: HTMLElement, opts: { sitekey: string; callback: (t: string) => void; "expired-callback": () => void; language: string }) => string;
  remove: (id: string) => void;
};

// Optional Cloudflare Turnstile CAPTCHA. Rendered only when a site key is configured on the server.
export function Turnstile({ siteKey, onToken }: { siteKey: string; onToken: (t: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const w = window as unknown as { turnstile?: TurnstileApi };
    let widgetId: string | null = null;
    const render = () => {
      if (!ref.current || !w.turnstile || widgetId) return;
      widgetId = w.turnstile.render(ref.current, {
        sitekey: siteKey,
        language: "ar",
        callback: onToken,
        "expired-callback": () => onToken(""),
      });
    };
    if (w.turnstile) {
      render();
    } else {
      const existing = document.getElementById("cf-turnstile-script");
      if (existing) {
        existing.addEventListener("load", render);
      } else {
        const s = document.createElement("script");
        s.id = "cf-turnstile-script";
        s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
        s.async = true;
        s.defer = true;
        s.addEventListener("load", render);
        document.head.appendChild(s);
      }
    }
    return () => {
      if (widgetId && w.turnstile) w.turnstile.remove(widgetId);
    };
  }, [siteKey, onToken]);

  return <div ref={ref} className="min-h-16" />;
}
