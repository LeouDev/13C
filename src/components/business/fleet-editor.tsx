"use client";

import { useState, useTransition } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { addServiceLog, deleteServiceLog, saveFleetInfo } from "@/app/actions/vehicles";
import { Pill } from "@/components/common/badges";
import { Field } from "@/components/common/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { dueKm, dueOn, type Due } from "@/lib/fleet";
import { formatDate, formatPHP, todayManila } from "@/lib/format";

type Fleet = { registration_expires_on: string | null; insurance_expires_on: string | null; odometer_km: number | null; next_service_on: string | null; next_service_km: number | null };
type Log = { id: string; serviced_on: string; kind: string; odometer_km: number | null; cost: number | null; note: string | null };

const str = (v: string | number | null | undefined) => (v == null ? "" : String(v));
const TONE = { danger: "danger", warning: "warning", neutral: "neutral" } as const;
const DueHint = ({ due }: { due: Due | null }) => (due?.urgent ? <Pill tone={TONE[due.tone]} className="mt-1">{due.label}</Pill> : null);

/** Registration, insurance, odometer and service schedule for one car, plus its service history (Business plan). */
export function FleetEditor({ businessId, vehicleId, fleet, logs, canEdit }: {
  businessId: string; vehicleId: string; fleet: Fleet | null; logs: Log[]; canEdit: boolean;
}) {
  const [f, setF] = useState({
    registration_expires_on: str(fleet?.registration_expires_on), insurance_expires_on: str(fleet?.insurance_expires_on),
    odometer_km: str(fleet?.odometer_km), next_service_on: str(fleet?.next_service_on), next_service_km: str(fleet?.next_service_km),
  });
  const blankLog = { serviced_on: todayManila(), kind: "", odometer_km: "", cost: "", note: "" };
  const [log, setLog] = useState(blankLog);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [logErrors, setLogErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const odometer = f.odometer_km === "" ? null : Number(f.odometer_km);

  const save = () => start(async () => {
    const r = await saveFleetInfo(businessId, vehicleId, f);
    if (r.ok) { setErrors({}); toast.success(r.message); } else { setErrors(r.fieldErrors ?? {}); toast.error(r.error); }
  });
  const add = () => start(async () => {
    const r = await addServiceLog(businessId, vehicleId, log);
    if (r.ok) { setLogErrors({}); setLog(blankLog); toast.success(r.message); } else { setLogErrors(r.fieldErrors ?? {}); toast.error(r.error); }
  });

  return (
    <div className="grid gap-6">
      <section className="rounded-3xl border bg-white p-5 sm:p-6">
        <h2 className="font-semibold text-navy-900">Papers & service schedule</h2>
        <p className="mt-1 text-sm text-muted-foreground">Dates within 30 days (or service within 1,000 km) show up on your Fleet page.</p>
        <div className="mt-4 grid items-start gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Registration (OR/CR) expires" htmlFor="reg" error={errors.registration_expires_on}>
            <Input id="reg" type="date" value={f.registration_expires_on} disabled={!canEdit} onChange={(e) => setF({ ...f, registration_expires_on: e.target.value })} />
            <DueHint due={dueOn(f.registration_expires_on)} />
          </Field>
          <Field label="Insurance expires" htmlFor="ins" error={errors.insurance_expires_on}>
            <Input id="ins" type="date" value={f.insurance_expires_on} disabled={!canEdit} onChange={(e) => setF({ ...f, insurance_expires_on: e.target.value })} />
            <DueHint due={dueOn(f.insurance_expires_on)} />
          </Field>
          <Field label="Odometer (km)" htmlFor="odo" error={errors.odometer_km}>
            <Input id="odo" type="number" inputMode="numeric" min={0} value={f.odometer_km} disabled={!canEdit} onChange={(e) => setF({ ...f, odometer_km: e.target.value })} />
          </Field>
          <Field label="Next service date" htmlFor="svc-date" error={errors.next_service_on}>
            <Input id="svc-date" type="date" value={f.next_service_on} disabled={!canEdit} onChange={(e) => setF({ ...f, next_service_on: e.target.value })} />
            <DueHint due={dueOn(f.next_service_on)} />
          </Field>
          <Field label="Next service at (km)" htmlFor="svc-km" error={errors.next_service_km}>
            <Input id="svc-km" type="number" inputMode="numeric" min={0} value={f.next_service_km} disabled={!canEdit} onChange={(e) => setF({ ...f, next_service_km: e.target.value })} />
            <DueHint due={dueKm(f.next_service_km === "" ? null : Number(f.next_service_km), odometer)} />
          </Field>
        </div>
        {canEdit && <Button type="button" className="mt-4" disabled={pending} onClick={save}>{pending && <Loader2 className="animate-spin" />} Save details</Button>}
      </section>

      <section className="rounded-3xl border bg-white p-5 sm:p-6">
        <h2 className="font-semibold text-navy-900">Service history</h2>
        {canEdit && (
          <div className="mt-4 grid items-start gap-3 rounded-2xl bg-canvas p-4 sm:grid-cols-2 lg:grid-cols-[150px_1fr_130px_130px]">
            <Field label="Date" htmlFor="log-date" error={logErrors.serviced_on}>
              <Input id="log-date" type="date" value={log.serviced_on} onChange={(e) => setLog({ ...log, serviced_on: e.target.value })} />
            </Field>
            <Field label="What was done" htmlFor="log-kind" error={logErrors.kind}>
              <Input id="log-kind" value={log.kind} maxLength={80} placeholder="Oil change, tires, PMS…" onChange={(e) => setLog({ ...log, kind: e.target.value })} />
            </Field>
            <Field label="Odometer (km)" htmlFor="log-odo" error={logErrors.odometer_km}>
              <Input id="log-odo" type="number" inputMode="numeric" min={0} value={log.odometer_km} onChange={(e) => setLog({ ...log, odometer_km: e.target.value })} />
            </Field>
            <Field label="Cost (₱)" htmlFor="log-cost" error={logErrors.cost}>
              <Input id="log-cost" type="number" inputMode="decimal" min={0} step="0.01" value={log.cost} onChange={(e) => setLog({ ...log, cost: e.target.value })} />
            </Field>
            <Field label="Note (optional)" htmlFor="log-note" error={logErrors.note} className="sm:col-span-2 lg:col-span-3">
              <Input id="log-note" value={log.note} maxLength={1000} placeholder="Shop, parts, anything to remember" onChange={(e) => setLog({ ...log, note: e.target.value })} />
            </Field>
            <Button type="button" variant="outline" className="self-end" disabled={pending} onClick={add}><Plus /> Add entry</Button>
          </div>
        )}
        {logs.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">No service entries yet.</p>
        ) : (
          <ul className="mt-4 divide-y">
            {logs.map((l) => (
              <li key={l.id} className="flex items-start gap-3 py-3 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-navy-900">{l.kind}</p>
                  <p className="text-xs text-muted-foreground">
                    {[formatDate(l.serviced_on), l.odometer_km != null && `${l.odometer_km.toLocaleString("en-PH")} km`, l.cost != null && formatPHP(l.cost)].filter(Boolean).join(" · ")}
                  </p>
                  {l.note && <p className="mt-0.5 text-xs text-muted-foreground">{l.note}</p>}
                </div>
                {canEdit && (
                  <Button type="button" variant="ghost" size="icon-sm" aria-label={`Remove ${l.kind}`} disabled={pending}
                    onClick={() => start(async () => { const r = await deleteServiceLog(l.id); if (r.ok) toast.success(r.message); else toast.error(r.error); })}>
                    <Trash2 />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
