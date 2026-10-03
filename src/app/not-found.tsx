import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="grid min-h-svh place-items-center bg-navy-900 px-6 text-center text-white">
      <div>
        <Logo tone="light" speed className="mx-auto h-16" />
        <h1 className="mt-8 font-display-italic text-5xl">Wrong turn.</h1>
        <p className="mt-3 text-white/70">This page doesn&apos;t exist, or this store isn&apos;t public yet.</p>
        <div className="mt-8 flex justify-center gap-3">
          <Link href="/" className={buttonVariants({ variant: "light", size: "xl" })}>Go home</Link>
          <Link href="/explore" className={buttonVariants({ variant: "electric", size: "xl" })}>Find a car</Link>
        </div>
      </div>
    </main>
  );
}
