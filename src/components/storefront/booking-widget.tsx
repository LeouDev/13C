"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { createClient } from "@/lib/supabase/client";
import { friendlyError } from "@/lib/errors";
import { formatPHP, manilaToISO, todayManila } from "@/lib/format";

type Quote = { rental_days: number; base_amount: number; driver_fee: number; delivery_fee: number; total_amount: number; security_deposit: number; rate_applied: string };

export function BookingWidget({
  vehicleId, bookHref, dailyRate, selfDrive, withDriver, delivery, initialFrom, initialTo,
}: {
  vehicleId: string; bookHref: string; dailyRate: number; selfDrive: boolean; withDriver: boolean; delivery: boolean;
  initialFrom?: string; initialTo?: string;
}) {
  const [from, setFrom] = useState(initialFrom ?? todayManila(1));
  const [to, setTo] = useState(initialTo ?? todayManila(2));
  const [ft, setFt] = useState("10:00");
  const [tt, setTt] = useState("10:00");
  const [driver, setDriver] = useState(!selfDrive && withDriver);
  const [deliver, setDeliver] = useState(false);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let live = true;
    const t = setTimeout(async () => {
      setLoading(true);
      const supabase = createClient();
      const start = manilaToISO(from, ft), end = manilaToISO(to, tt);
      const [q, avail] = await Promise.all([
        supabase.rpc("quote_booking", { p_vehicle_id: vehicleId, p_pickup_at: start, p_return_at: end, p_with_driver: driver, p_delivery: deliver }),
        supabase.rpc("vehicle_unavailable_ranges", { p_vehicle_id: vehicleId, p_from: start, p_to: end }),
      ]);
      if (!live) return;
      setLoading(false);
      if (q.error) { setQuote(null); setError(friendlyError(q.error)); return; }
      setQuote(q.data as unknown as Quote);
      setError(avail.data?.length ? "This car isn't available for all of those dates. Try other dates." : null);
    }, 250);
    return () => { live = false; clearTimeout(t); };
  }, [vehicleId, from, to, ft, tt, driver, deliver]);

  const qs = new URLSearchParams({ from, to, ft, tt, ...(driver ? { driver: "1" } : {}), ...(deliver ? { delivery: "1" } : {}) });
  const input = "w-full min-w-0 rounded-xl border border-input bg-white px-3 py-2 text-sm font-semibold text-navy-900 outline-none focus:border-[var(--store-accent)]";

  return (
    <div className="rounded-3xl bg-white p-5 shadow-[0_24px_60px_-30px_rgba(10,20,48,0.4)] ring-1 ring-black/5">
      <div className="flex items-baseline gap-1">
        <span className="font-display text-3xl font-bold text-navy-900">{formatPHP(dailyRate)}</span>
        <span className="text-sm text-muted-foreground">/ day</span>
      </div>
      <div className="mt-4 grid grid-cols-[minmax(0,1fr)_auto] gap-2">
        <label className="grid gap-1 text-[11px] font-semibold text-muted-foreground uppercase">Pickup<input type="date" className={input} value={from} min={todayManila()} onChange={(e) => { setFrom(e.target.value); if (e.target.value >= to) setTo(new Date(new Date(`${e.target.value}T00:00:00Z`).getTime() + 86400000).toISOString().slice(0, 10)); }} /></label>
        <label className="grid gap-1 text-[11px] font-semibold text-muted-foreground uppercase">Time<input type="time" className={input} value={ft} onChange={(e) => setFt(e.target.value)} /></label>
        <label className="grid gap-1 text-[11px] font-semibold text-muted-foreground uppercase">Return<input type="date" className={input} value={to} min={from} onChange={(e) => setTo(e.target.value)} /></label>
        <label className="grid gap-1 text-[11px] font-semibold text-muted-foreground uppercase">Time<input type="time" className={input} value={tt} onChange={(e) => setTt(e.target.value)} /></label>
      </div>
      {(withDriver && selfDrive) || delivery ? (
        <div className="mt-3 grid gap-2">
          {withDriver && selfDrive && <label className="flex items-center justify-between rounded-xl bg-canvas px-3 py-2 text-sm">Add a driver <Switch checked={driver} onCheckedChange={setDriver} /></label>}
          {delivery && <label className="flex items-center justify-between rounded-xl bg-canvas px-3 py-2 text-sm">Deliver to me <Switch checked={deliver} onCheckedChange={setDeliver} /></label>}
        </div>
      ) : null}

      <div className="mt-4 min-h-24 rounded-2xl bg-canvas p-3 text-sm" aria-live="polite">
        {loading && !quote ? <Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" /> : quote ? (
          <dl className="grid gap-1.5">
            <div className="flex justify-between"><dt>{quote.rental_days} day{quote.rental_days > 1 ? "s" : ""}{quote.rate_applied !== "daily" ? ` (${quote.rate_applied} rate)` : ""}</dt><dd>{formatPHP(quote.base_amount)}</dd></div>
            {quote.driver_fee > 0 && <div className="flex justify-between"><dt>Driver</dt><dd>{formatPHP(quote.driver_fee)}</dd></div>}
            {quote.delivery_fee > 0 && <div className="flex justify-between"><dt>Delivery</dt><dd>{formatPHP(quote.delivery_fee)}</dd></div>}
            <div className="flex justify-between border-t border-black/10 pt-1.5 font-bold text-navy-900"><dt>Total</dt><dd>{formatPHP(quote.total_amount)}</dd></div>
            {quote.security_deposit > 0 && <div className="flex justify-between text-xs text-muted-foreground"><dt>Refundable deposit (paid to the business)</dt><dd>{formatPHP(quote.security_deposit)}</dd></div>}
          </dl>
        ) : null}
        {error && <p className="mt-2 flex gap-1.5 text-xs font-medium text-destructive"><AlertCircle className="size-4 shrink-0" />{error}</p>}
      </div>

      <Link href={`${bookHref}?${qs}`} aria-disabled={!!error || !quote}
        className={`mt-4 flex h-12 w-full items-center justify-center rounded-full text-[15px] font-semibold text-white shadow-md transition hover:brightness-110 ${error || !quote ? "pointer-events-none opacity-50" : ""}`}
        style={{ background: "var(--store-accent)" }}>
        Request Booking
      </Link>
      <p className="mt-2 text-center text-xs text-muted-foreground">You won&apos;t be charged. The business confirms first.</p>
    </div>
  );
}
