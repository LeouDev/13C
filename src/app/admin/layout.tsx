import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { AdminNav } from "@/components/admin/admin-nav";
import { requireAdmin } from "@/lib/auth";

export const metadata: Metadata = { title: { default: "Admin", template: "%s · 13C Admin" }, robots: { index: false } };

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const user = await requireAdmin();
  return (
    <div className="flex min-h-svh flex-col bg-canvas lg:flex-row">
      <aside className="border-b bg-navy-950 text-white lg:sticky lg:top-0 lg:h-svh lg:w-60 lg:shrink-0 lg:border-r lg:border-b-0">
        <div className="flex items-center justify-between gap-3 p-4">
          <Link href="/admin" className="flex items-center gap-2"><Logo tone="light" className="h-6" /><span className="eyebrow text-cyan">Admin</span></Link>
          <Link href="/" className="text-xs text-white/60 hover:text-white lg:hidden">Exit</Link>
        </div>
        <AdminNav />
        <p className="hidden px-4 pt-6 text-[11px] text-white/40 lg:block">{user.email}</p>
      </aside>
      <main className="mx-auto w-full min-w-0 max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">{children}</main>
    </div>
  );
}
