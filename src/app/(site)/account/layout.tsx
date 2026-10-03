import type { Metadata } from "next";
import { AccountNav } from "@/components/account/account-nav";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = { title: { default: "My account", template: "%s · 13C" }, robots: { index: false } };

export default async function AccountLayout({ children }: LayoutProps<"/account">) {
  await requireUser("/account");
  return (
    <div className="bg-[#f6f7f9]">
      <div className="container-page py-6 sm:py-8">
        <AccountNav />
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}
