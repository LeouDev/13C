import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { AdminNav } from "@/components/admin/admin-nav";
import { requireAdmin } from "@/lib/auth";

export const metadata: Metadata = { title: { default: "Admin", template: "%s · 13C Admin" }, robots: { index: false } };

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const user = await requireAdmin();
  return (
    <div className="flex min-h-svh flex-col bg-canvas lg:flex-row">
      <aside className="border-b bg-navy-950 text-white lg:sticky lg:top-0 lg:flex lg:h-svh lg:w-60 lg:shrink-0 lg:flex-col lg:overflow-y-auto lg:border-r lg:border-b-0">
        <div className="flex items-center justify-between gap-3 p-4">
          <Link href="/admin" className="flex items-center gap-2"><Logo tone="light" className="h-6" /><span className="eyebrow text-cyan">Admin</span></Link>
          <Link href="/" className="flex items-center gap-1 text-xs font-medium text-white/70 hover:text-white lg:hidden"><ArrowLeft className="size-3.5" /> Back to 13C</Link>
        </div>
        <AdminNav />
        <div className="mt-auto hidden border-t border-white/10 p-3 lg:block">
          <Link href="/" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-white/65 transition hover:bg-white/5 hover:text-white"><ArrowLeft className="size-4" /> Back to 13C</Link>
          <p className="truncate px-3 pt-1 text-[11px] text-white/40">{user.email}</p>
        </div>
      </aside>
      <main className="mx-auto w-full min-w-0 max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">{children}</main>
    </div>
  );
}
