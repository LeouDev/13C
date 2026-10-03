import Link from "next/link";
import { Building2, CalendarCheck, Heart, LayoutDashboard, LogOut, Menu, MessageSquare, Shield, User } from "lucide-react";
import { signOut } from "@/app/actions/auth";
import { Logo } from "@/components/brand/logo";
import { NotificationBell } from "@/components/site/notification-bell";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { buttonVariants } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { getCurrentUser, getMemberships } from "@/lib/auth";
import { initials } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

const NAV = [
  { href: "/explore", label: "Find a car" },
  { href: "/explore?view=businesses", label: "Rental businesses" },
  { href: "/for-business", label: "For businesses" },
];

export async function SiteHeader() {
  const user = await getCurrentUser();
  const memberships = user ? await getMemberships() : [];
  let unread = 0;
  if (user) {
    const supabase = await createClient();
    const { count } = await supabase.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null);
    unread = count ?? 0;
  }

  return (
    <header className="sticky top-0 z-40 border-b border-black/5 bg-white/85 backdrop-blur-xl">
      <div className="container-page flex h-16 items-center gap-4">
        <Link href="/" className="shrink-0" aria-label="13C home">
          <Logo className="h-8" />
        </Link>
        <nav className="ml-4 hidden items-center gap-1 md:flex" aria-label="Main">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="rounded-full px-3.5 py-2 text-sm font-medium text-navy-800 transition hover:bg-canvas">
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-1.5">
          {user ? (
            <>
              {memberships.length > 0 ? (
                <Link href="/dashboard" className={buttonVariants({ variant: "outline", className: "hidden rounded-full sm:inline-flex" })}>
                  <LayoutDashboard /> Dashboard
                </Link>
              ) : (
                <Link href="/register/business" className="hidden rounded-full px-3.5 py-2 text-sm font-medium text-navy-800 hover:bg-canvas lg:block">
                  List your cars
                </Link>
              )}
              <NotificationBell userId={user.id} initialUnread={unread} />
              <DropdownMenu>
                <DropdownMenuTrigger className="rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50" aria-label="Account menu">
                  <Avatar className="size-9">
                    <AvatarFallback className="bg-navy-900 text-xs font-semibold text-white">{initials(user.full_name || user.email)}</AvatarFallback>
                  </Avatar>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="truncate">{user.full_name || user.email}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem render={<Link href="/account/bookings" />}><CalendarCheck /> My bookings</DropdownMenuItem>
                  <DropdownMenuItem render={<Link href="/account/messages" />}><MessageSquare /> Messages</DropdownMenuItem>
                  <DropdownMenuItem render={<Link href="/account/favorites" />}><Heart /> Saved cars</DropdownMenuItem>
                  <DropdownMenuItem render={<Link href="/account" />}><User /> Profile & documents</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {memberships.length > 0 ? (
                    <DropdownMenuItem render={<Link href="/dashboard" />}><LayoutDashboard /> Business dashboard</DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem render={<Link href="/register/business" />}><Building2 /> Register a business</DropdownMenuItem>
                  )}
                  {user.is_admin && <DropdownMenuItem render={<Link href="/admin" />}><Shield /> Admin</DropdownMenuItem>}
                  <DropdownMenuSeparator />
                  <form action={signOut}>
                    <DropdownMenuItem render={<button type="submit" className="w-full" />}><LogOut /> Sign out</DropdownMenuItem>
                  </form>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <>
              <Link href="/login" className="rounded-full px-3.5 py-2 text-sm font-semibold whitespace-nowrap text-navy-900 hover:bg-canvas">Sign in</Link>
              <Link href="/signup" className={buttonVariants({ className: "hidden h-10 rounded-full px-5 sm:inline-flex" })}>Get started</Link>
            </>
          )}
          <Sheet>
            <SheetTrigger className="grid size-10 place-items-center rounded-full hover:bg-black/5 md:hidden" aria-label="Open menu">
              <Menu className="size-5" />
            </SheetTrigger>
            <SheetContent side="right" className="w-[85vw] max-w-sm p-6">
              <SheetTitle className="sr-only">Menu</SheetTitle>
              <Logo className="h-8" />
              <nav className="mt-6 grid gap-1" aria-label="Mobile">
                {NAV.map((n) => (
                  <Link key={n.href} href={n.href} className="rounded-xl px-3 py-3 text-base font-medium hover:bg-canvas">{n.label}</Link>
                ))}
                {user && (
                  <>
                    <Link href="/account/bookings" className="rounded-xl px-3 py-3 text-base font-medium hover:bg-canvas">My bookings</Link>
                    <Link href="/account/messages" className="rounded-xl px-3 py-3 text-base font-medium hover:bg-canvas">Messages</Link>
                    {memberships.length > 0 && <Link href="/dashboard" className="rounded-xl px-3 py-3 text-base font-medium hover:bg-canvas">Business dashboard</Link>}
                  </>
                )}
              </nav>
              {!user && (
                <div className="mt-auto grid gap-2">
                  <Link href="/signup" className={buttonVariants({ size: "xl" })}>Get started</Link>
                  <Link href="/login" className={buttonVariants({ size: "xl", variant: "outline" })}>Sign in</Link>
                </div>
              )}
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
