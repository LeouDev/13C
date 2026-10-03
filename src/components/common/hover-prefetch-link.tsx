"use client";

import Link from "next/link";
import { useState, type ComponentProps } from "react";

/**
 * A Link that prefetches only once the pointer is on it (Next's hover-triggered prefetch). For dashboard pages,
 * where prefetching every visible link to a dynamic page costs a server render each on every view.
 */
export function HoverPrefetchLink({ onMouseEnter, ...props }: ComponentProps<typeof Link>) {
  const [intent, setIntent] = useState(false);
  return <Link {...props} prefetch={intent ? null : false} onMouseEnter={(e) => { setIntent(true); onMouseEnter?.(e); }} />;
}
