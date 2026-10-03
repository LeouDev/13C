"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/common/states";
import { Button } from "@/components/ui/button";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <main className="container-page grid min-h-[60svh] place-items-center py-16">
      <ErrorState title="Something went wrong" description="We couldn't load this page. Please try again — if it keeps happening, contact support@13c.online.">
        <Button onClick={reset}>Try again</Button>
      </ErrorState>
    </main>
  );
}
