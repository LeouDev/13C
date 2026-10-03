import Link from "next/link";
import { redirect } from "next/navigation";
import { UserRoundX } from "lucide-react";
import { signOut } from "@/app/actions/auth";
import { EmptyState } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import { getMemberships } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/**
 * A renter's booking link opened while signed in as someone else (e.g. the business's own email).
 * Business members are sent to the dashboard view of that booking; anyone else is told whose account it's on.
 */
export async function BookingOnOtherAccount({ bookingId, email }: { bookingId: string; email: string | null }) {
  const supabase = await createClient();
  const { data: b } = await supabase.from("bookings").select("business_id").eq("id", bookingId).maybeSingle(); // RLS: parties only
  if (b && (await getMemberships()).some((m) => m.business.id === b.business_id)) redirect(`/dashboard/bookings/${bookingId}`);
  return (
    <EmptyState icon={UserRoundX} title="This booking is on another account"
      description={<>You&apos;re signed in as <strong>{email}</strong>. Sign in with the account the booking email was sent to.</>}
      action={
        <div className="flex flex-wrap justify-center gap-2">
          <form action={signOut}>
            <input type="hidden" name="next" value={`/account/bookings/${bookingId}`} />
            <Button type="submit">Sign in with another account</Button>
          </form>
          <Link href="/account/bookings" className="inline-flex h-9 items-center rounded-full px-4 text-sm font-semibold text-navy-900 hover:bg-canvas">My bookings</Link>
        </div>
      } />
  );
}
