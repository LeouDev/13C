"use client";

import { useEffect } from "react";

/** No zoom (like a native app), and edge to edge so the tab bar can sit above the iPhone's home bar (env(safe-area-inset-bottom)). */
const APP_VIEWPORT = ", maximum-scale=1, user-scalable=no, viewport-fit=cover";

/**
 * Opened from the Home Screen (as an app): no pinch, double-tap or tap-to-type zoom, like a native app. A browser tab
 * keeps zoom, for accessibility. App-mode styles are in globals.css under (display-mode: standalone).
 * Next.js rewrites the viewport tag when the page changes, so it's re-applied whenever that happens.
 */
export function AppMode() {
  useEffect(() => {
    const app = matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
    if (!app) return;
    const apply = () => {
      const viewport = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
      if (viewport && !viewport.content.includes("user-scalable=no")) viewport.content += APP_VIEWPORT;
    };
    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.head, { childList: true, subtree: true, attributes: true, attributeFilter: ["content"] });
    // iPhones also zoom through their own pinch gesture events
    const stop = (e: Event) => e.preventDefault();
    for (const type of ["gesturestart", "gesturechange"]) document.addEventListener(type, stop);
    return () => {
      observer.disconnect();
      for (const type of ["gesturestart", "gesturechange"]) document.removeEventListener(type, stop);
    };
  }, []);
  return null;
}
