import { CalendarCheck, ChevronRight, FileSignature, HandCoins, IdCard, KeyRound, MessageCircle, Star, type LucideIcon } from "lucide-react";
import { HoverPrefetchLink } from "@/components/common/hover-prefetch-link";
import { TERMINAL_STATUSES } from "@/lib/bookings/status";
import { customerConversations } from "@/lib/conversations";
import { formatDate, formatDateTime, formatPHP, isoDaysFromNow } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

type Item = { icon: LucideIcon; title: string; detail: string; href: string };

/** The top of the Account page: what's coming up and what needs the renter, so they don't have to check each booking. */
export async function RenterOverview({ userId, docsReady }: { userId: string; docsReady: boolean }) {
  const supabase = await createClient();
  const [{ data }, chats] = await Promise.all([
    supabase.from("bookings")
      .select("id, reference, status, pickup_at, pickup_location, down_payment_amount, down_payment_due_at, down_payment_reported_at, payments(amount), vehicles(make, model), businesses(name), reviews(id)")
      .eq("renter_id", userId).order("pickup_at").limit(100),
    customerConversations(userId),
  ]);
  const bookings = data ?? [];
  const car = (b: (typeof bookings)[number]) => `${b.vehicles?.make ?? ""} ${b.vehicles?.model ?? ""}`.trim() || b.reference;
  const where = (b: (typeof bookings)[number]) => `${car(b)} · ${b.businesses?.name ?? "the business"}`;
  const page = (b: { id: string }) => `/account/bookings/${b.id}`;

  const upcoming = bookings.filter((b) => !TERMINAL_STATUSES.includes(b.status) && b.status !== "INQUIRY" && b.status !== "NEGOTIATING");
  const toSign = bookings.filter((b) => b.status === "CONTRACT_SENT" || b.status === "AWAITING_SIGNATURE");
  const downDue = bookings.filter((b) => b.status === "APPROVED" && !b.down_payment_reported_at
    && Number(b.down_payment_amount) > b.payments.reduce((s, p) => s + Number(p.amount), 0));
  const unread = chats.filter((c) => c.unread);
  const now = isoDaysFromNow(0), soon = isoDaysFromNow(2);

  const items: Item[] = [
    ...toSign.map((b) => ({ icon: FileSignature, title: "Sign your rental agreement", detail: where(b), href: `${page(b)}/contract` })),
    ...downDue.map((b) => ({
      icon: HandCoins, href: page(b), title: `Send the ${formatPHP(b.down_payment_amount)} down payment`,
      detail: `${b.down_payment_due_at ? `By ${formatDate(b.down_payment_due_at, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} · ` : ""}${where(b)}`,
    })),
    ...bookings.filter((b) => b.status === "BOOKING_REQUESTED").map((b) => ({ icon: CalendarCheck, title: "Review a booking proposal", detail: where(b), href: page(b) })),
    ...(!docsReady && bookings.some((b) => b.status === "PENDING_OWNER_APPROVAL" || b.status === "BOOKING_REQUESTED")
      ? [{ icon: IdCard, title: "Upload your driver's license and ID", detail: "The business can approve your request once they're in", href: "/account#documents" }] : []),
    ...unread.slice(0, 3).map((c) => ({ icon: MessageCircle, title: `New message from ${c.title}`, detail: c.preview ?? "Open the chat", href: `/account/messages/${c.id}` })),
    ...bookings.filter((b) => b.status === "CONFIRMED" && b.pickup_at < soon)
      .map((b) => ({ icon: KeyRound, title: `Pickup ${formatDateTime(b.pickup_at)}`, detail: `${car(b)} · ${b.pickup_location}`, href: page(b) })),
    ...bookings.filter((b) => b.status === "COMPLETED" && !b.reviews).slice(0, 2)
      .map((b) => ({ icon: Star, title: `How was the ${car(b)}? Leave a review`, detail: b.businesses?.name ?? "", href: page(b) })),
  ];

  const next = upcoming.find((b) => b.pickup_at >= now);
  const tiles = [
    { label: "Upcoming bookings", value: upcoming.length, hint: next ? `Next pickup ${formatDate(next.pickup_at, { month: "short", day: "numeric" })}` : upcoming.length ? "On the road now" : "None yet", href: "/account/bookings" },
    { label: "Agreements to sign", value: toSign.length, hint: toSign.length ? "Waiting for your signature" : "All signed", href: toSign[0] ? `${page(toSign[0])}/contract` : "/account/bookings" },
    { label: "Down payments due", value: downDue.length, hint: downDue.length ? "To hold your car" : "Nothing due", href: downDue[0] ? page(downDue[0]) : "/account/bookings" },
    { label: "Unread messages", value: unread.length, hint: unread.length ? "From rental businesses" : "All read", href: "/account/messages" },
  ];

  return (
    <section className="grid gap-4" aria-labelledby="overview-title">
      <h2 id="overview-title" className="sr-only">Overview</h2>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((t) => (
          <HoverPrefetchLink key={t.label} href={t.href} className="rounded-3xl bg-white p-4 ring-1 ring-black/5 transition hover:ring-electric/40">
            <p className="text-sm text-muted-foreground">{t.label}</p>
            <p className="mt-1 font-display text-3xl font-bold text-navy-900">{t.value}</p>
            <p className={t.value ? "text-xs font-semibold text-electric" : "text-xs text-muted-foreground"}>{t.hint}</p>
          </HoverPrefetchLink>
        ))}
      </div>
      <div className="rounded-3xl bg-white p-5 ring-1 ring-black/5 sm:p-6">
        <h3 className="font-semibold text-navy-900">Needs your attention</h3>
        {items.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">You&apos;re all caught up.</p>
        ) : (
          <ul className="mt-2 divide-y">
            {items.map((x) => (
              <li key={`${x.href}-${x.title}`}>
                <HoverPrefetchLink href={x.href} className="flex items-center gap-3 py-3 hover:bg-canvas/60">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-electric/10 text-electric"><x.icon className="size-5" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-navy-900">{x.title}</span>
                    <span className="block truncate text-xs text-muted-foreground">{x.detail}</span>
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                </HoverPrefetchLink>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
