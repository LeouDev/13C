"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Opened from the Home Screen (as an app): no pinch, double-tap or tap-to-type zoom, like a native app. A browser tab
 * keeps zoom, for accessibility. App-mode styles are in globals.css under (display-mode: standalone).
 * Re-applied on each page change in case the viewport tag is re-rendered.
 */
export function AppMode() {
  const pathname = usePathname();
  useEffect(() => {
    const app = matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
    if (!app) return;
    const viewport = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
    if (viewport && !viewport.content.includes("user-scalable=no")) viewport.content += ", maximum-scale=1, user-scalable=no";
    // iPhones also zoom through their own pinch gesture events
    const stop = (e: Event) => e.preventDefault();
    for (const type of ["gesturestart", "gesturechange"]) document.addEventListener(type, stop);
    return () => { for (const type of ["gesturestart", "gesturechange"]) document.removeEventListener(type, stop); };
  }, [pathname]);
  return null;
}
