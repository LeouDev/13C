import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Pill } from "@/components/common/badges";
import { EmptyState, PageHeader } from "@/components/common/states";
import { BusinessUpsell } from "@/components/dashboard/business-upsell";
import { requireBusiness } from "@/lib/auth";
import { BUSINESS_FEATURES } from "@/lib/constants";
import { dueKm, dueOn, type Due } from "@/lib/fleet";
import { formatDateTime, labelize } from "@/lib/format";
import { businessPlanActive } from "@/lib/plans";
import { getSubscription } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Fleet" };

const RANK = { danger: 0, warning: 1, neutral: 2 } as const;
const worst = (...d: (Due | null)[]) => d.filter((x): x is Due => !!x).sort((a, b) => RANK[a.tone] - RANK[b.tone])[0] ?? null;
const DueCell = ({ due }: { due: Due | null }) => (!due ? <span className="text-muted-foreground">—</span>
  : due.urgent ? <Pill tone={due.tone === "danger" ? "danger" : "warning"}>{due.label}</Pill> : <span>{due.label}</span>);

export default async function FleetPage() {
  const { business } = await requireBusiness();
  const header = <PageHeader eyebrow="Fleet" title="Fleet" description="Papers, servicing and today's status for every car." />;
  if (!businessPlanActive(await getSubscription(business.id))) {
    return <>{header}<BusinessUpsell title="Fleet management is on the Business plan" points={BUSINESS_FEATURES.fleet} /></>;
  }

  const supabase = await createClient();
  const now = new Date().toISOString();
  const [{ data: vehicles }, { data: fleet }, { data: bookings }, { data: blocks }] = await Promise.all([
    supabase.from("vehicles").select("id, year, make, model, plate_number, status").eq("business_id", business.id).is("deleted_at", null).order("created_at"),
    supabase.from("vehicle_fleet").select("vehicle_id, registration_expires_on, insurance_expires_on, odometer_km, next_service_on, next_service_km").eq("business_id", business.id),
    supabase.from("bookings").select("id, vehicle_id, pickup_at, status").eq("business_id", business.id)
      .in("status", ["SIGNED", "CONFIRMED", "ACTIVE"]).gte("return_at", now).order("pickup_at"),
    supabase.from("vehicle_blocked_dates").select("vehicle_id, reason").eq("business_id", business.id).lte("starts_at", now).gte("ends_at", now),
  ]);
  if (!vehicles?.length) return <>{header}<EmptyState title="No cars yet" description="Add a vehicle first." action={{ label: "Add vehicle", href: "/dashboard/vehicles/new" }} /></>;

  const rows = vehicles.map((v) => {
    const f = fleet?.find((x) => x.vehicle_id === v.id);
    const onRent = bookings?.find((b) => b.vehicle_id === v.id && b.status === "ACTIVE");
    const next = bookings?.find((b) => b.vehicle_id === v.id && b.status !== "ACTIVE" && b.pickup_at > now);
    const block = blocks?.find((b) => b.vehicle_id === v.id);
    const today = onRent ? ["On rent", "brand"] as const : block ? [labelize(block.reason), "warning"] as const
      : v.status !== "ACTIVE" ? [labelize(v.status), "neutral"] as const : ["Available", "success"] as const;
    const items = [
      ["Registration", dueOn(f?.registration_expires_on)],
      ["Insurance", dueOn(f?.insurance_expires_on)],
      ["Service", worst(dueOn(f?.next_service_on), dueKm(f?.next_service_km, f?.odometer_km))],
    ] as const;
    return { v, f, today, next, items, name: `${v.year} ${v.make} ${v.model}` };
  });
  const alerts = rows.flatMap((r) => r.items.filter(([, d]) => d?.urgent).map(([label, d]) => ({ r, label, due: d! })))
    .sort((a, b) => RANK[a.due.tone] - RANK[b.due.tone]);

  return (
    <>
      {header}
      {alerts.length > 0 && (
        <section className="mb-6 rounded-3xl border border-amber-200 bg-amber-50 p-5">
          <h2 className="flex items-center gap-2 font-semibold text-amber-900"><AlertTriangle className="size-5" /> Needs attention</h2>
          <ul className="mt-3 grid gap-2 text-sm">
            {alerts.map((a) => (
              <li key={`${a.r.v.id}-${a.label}`} className="flex flex-wrap items-center gap-2">
                <Pill tone={a.due.tone === "danger" ? "danger" : "warning"}>{a.due.label}</Pill>
                <Link href={`/dashboard/vehicles/${a.r.v.id}?tab=fleet`} className="font-medium text-navy-900 hover:underline">{a.r.name}</Link>
                <span className="text-amber-900/80">· {a.label}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <section className="overflow-x-auto rounded-3xl border bg-white">
        <table className="w-full min-w-[860px] text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              {["Vehicle", "Today", "Next pickup", "Registration", "Insurance", "Service", "Odometer"].map((h) => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ v, f, today, next, items, name }) => (
              <tr key={v.id} className="border-b last:border-0">
                <td className="px-4 py-3">
                  <Link href={`/dashboard/vehicles/${v.id}?tab=fleet`} className="font-medium text-navy-900 hover:underline">{name}</Link>
                  {v.plate_number && <span className="block font-mono text-xs text-muted-foreground">{v.plate_number}</span>}
                </td>
                <td className="px-4 py-3"><Pill tone={today[1]}>{today[0]}</Pill></td>
                <td className="px-4 py-3">{next ? <Link href={`/dashboard/bookings/${next.id}`} className="hover:underline">{formatDateTime(next.pickup_at)}</Link> : <span className="text-muted-foreground">—</span>}</td>
                {items.map(([label, d]) => <td key={label} className="px-4 py-3"><DueCell due={d} /></td>)}
                <td className="px-4 py-3 tabular-nums">{f?.odometer_km != null ? `${f.odometer_km.toLocaleString("en-PH")} km` : <span className="text-muted-foreground">—</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <p className="mt-3 text-xs text-muted-foreground">Open a car to update its papers, odometer and service history.</p>
    </>
  );
}
