"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CalendarPlus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { proposeBooking } from "@/app/actions/bookings";
import { Field, NativeSelect } from "@/components/common/field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { todayManila } from "@/lib/format";

/** Converts a conversation into a booking proposal the customer can accept (spec: "Convert to Booking Request"). */
export function ProposeBooking({ conversationId, vehicles, defaultVehicleId, defaultLocation }: {
  conversationId: string; vehicles: { id: string; make: string; model: string; year: number }[]; defaultVehicleId: string | null; defaultLocation: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [f, setF] = useState({
    vehicleId: defaultVehicleId ?? vehicles[0]?.id ?? "", from: todayManila(1), fromTime: "10:00", to: todayManila(2), toTime: "10:00",
    pickupLocation: defaultLocation, returnLocation: defaultLocation, withDriver: false, delivery: false, notes: "",
  });
  const bind = (k: "from" | "fromTime" | "to" | "toTime" | "pickupLocation" | "returnLocation") => ({ value: f[k], onChange: (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value }) });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant="electric" />}><CalendarPlus /> Create booking request</DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Propose a booking</DialogTitle>
          <DialogDescription>The customer gets the proposal with the price, and accepting it approves the booking and prepares the agreement.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Vehicle" className="col-span-2" error={errors.vehicleId}>
            <NativeSelect value={f.vehicleId} onChange={(e) => setF({ ...f, vehicleId: e.target.value })}>
              {vehicles.map((v) => <option key={v.id} value={v.id}>{v.year} {v.make} {v.model}</option>)}
            </NativeSelect>
          </Field>
          <Field label="Pickup date" error={errors.from}><Input type="date" min={todayManila()} {...bind("from")} /></Field>
          <Field label="Time"><Input type="time" {...bind("fromTime")} /></Field>
          <Field label="Return date" error={errors.to}><Input type="date" min={f.from} {...bind("to")} /></Field>
          <Field label="Time"><Input type="time" {...bind("toTime")} /></Field>
          <Field label="Pickup location" className="col-span-2" error={errors.pickupLocation}><Input {...bind("pickupLocation")} /></Field>
          <Field label="Return location" className="col-span-2" error={errors.returnLocation}><Input {...bind("returnLocation")} /></Field>
          <label className="flex items-center justify-between rounded-xl bg-canvas px-3 py-2 text-sm">With driver <Switch checked={f.withDriver} onCheckedChange={(c) => setF({ ...f, withDriver: c })} /></label>
          <label className="flex items-center justify-between rounded-xl bg-canvas px-3 py-2 text-sm">Delivery <Switch checked={f.delivery} onCheckedChange={(c) => setF({ ...f, delivery: c })} /></label>
          <Field label="Note" className="col-span-2"><Textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} maxLength={2000} placeholder="e.g. Delivery to Mactan Airport included" /></Field>
        </div>
        <Button size="lg" disabled={pending || !f.vehicleId} onClick={() => start(async () => {
          const r = await proposeBooking({ conversationId, ...f });
          if (r.ok) { toast.success(r.message); setOpen(false); router.refresh(); } else { setErrors(r.fieldErrors ?? {}); toast.error(r.error); }
        })}>
          {pending && <Loader2 className="animate-spin" />} Send proposal
        </Button>
      </DialogContent>
    </Dialog>
  );
}
