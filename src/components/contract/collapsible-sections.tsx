"use client";

import { useState } from "react";
import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";

/** On large screens the agreement text starts as a preview; phones always show all of it. */
export function CollapsibleSections({ count, children }: { count: number; children: React.ReactNode }) {
  const [expanded, setExpanded] = useState(false);
  if (expanded) return children;
  return (
    <>
      <div className="relative lg:max-h-[330px] lg:overflow-hidden">
        {children}
        <span className="pointer-events-none absolute inset-x-0 bottom-0 hidden h-[110px] bg-linear-to-b from-white/0 to-white lg:block" />
      </div>
      <div className="hidden justify-center pb-6 lg:flex">
        <Button variant="outline" size="lg" onClick={() => setExpanded(true)}><FileText /> Read all {count} sections</Button>
      </div>
    </>
  );
}
