"use client";

import { useEffect, useEffectEvent, useRef } from "react";

type TurnstileApi = {
  render: (el: HTMLElement, options: Record<string, unknown>) => string;
  reset: (id: string) => void;
  remove: (id: string) => void;
};
declare global { interface Window { turnstile?: TurnstileApi } }

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
/** Bot checks are on once a Turnstile site key is configured; Supabase Auth then verifies the token. */
export const captchaEnabled = !!SITE_KEY;

let script: Promise<TurnstileApi> | undefined;
function loadTurnstile() {
  script ??= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    s.async = true;
    s.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error("Turnstile unavailable")));
    s.onerror = () => { script = undefined; reject(new Error("Turnstile unavailable")); };
    document.head.append(s);
  });
  return script;
}

/**
 * Cloudflare Turnstile bot check. Inside a form it adds the `cf-turnstile-response` field, which the auth actions
 * pass to Supabase as the captcha token. Tokens are single-use, so the widget resets whenever `resetKey` changes
 * (after each submission). `onToken` gets the token, or null while there isn't a valid one.
 */
export function Turnstile({ action, onToken, resetKey }: { action: string; onToken: (token: string | null) => void; resetKey?: unknown }) {
  const box = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);
  const report = useEffectEvent((token: string | null) => onToken(token));

  useEffect(() => {
    if (!SITE_KEY) return;
    let gone = false;
    loadTurnstile().then((turnstile) => {
      if (gone || !box.current) return;
      widget.current = turnstile.render(box.current, {
        sitekey: SITE_KEY,
        action,
        theme: "light",
        size: "flexible",
        callback: (token: string) => report(token),
        "expired-callback": () => report(null),
        "error-callback": () => report(null),
      });
    }, () => report(null));
    return () => {
      gone = true;
      if (widget.current) window.turnstile?.remove(widget.current);
      widget.current = null;
    };
  }, [action]);

  useEffect(() => {
    if (resetKey === undefined || !widget.current) return;
    report(null);
    window.turnstile?.reset(widget.current);
  }, [resetKey]);

  if (!SITE_KEY) return null;
  return <div ref={box} className="min-h-[65px]" />;
}
