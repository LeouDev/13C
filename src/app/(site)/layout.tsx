import { Suspense } from "react";
import { SiteTabBar } from "@/components/site/app-tab-bar";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { getCurrentUser } from "@/lib/auth";
import { customerUnreadCount } from "@/lib/conversations";

export default async function SiteLayout({ children }: LayoutProps<"/">) {
  const user = await getCurrentUser();
  return (
    <>
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
      <Suspense><SiteTabBar signedIn={!!user} unread={user ? await customerUnreadCount(user.id) : 0} /></Suspense>
    </>
  );
}
