"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { addTeamMember, removeTeamMember } from "@/app/actions/business";
import { NativeSelect } from "@/components/common/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function TeamManager({ businessId, members, canManage, planAllows }: {
  businessId: string; members: { user_id: string; role: string; name: string; email: string | null }[]; canManage: boolean; planAllows: boolean;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"MANAGER" | "STAFF">("STAFF");
  const [pending, start] = useTransition();
  return (
    <div className="grid gap-4">
      <ul className="divide-y rounded-2xl border">
        {members.map((m) => (
          <li key={m.user_id} className="flex items-center gap-3 px-4 py-3 text-sm">
            <span className="min-w-0 flex-1"><span className="block font-medium">{m.name || m.email}</span><span className="text-xs text-muted-foreground">{m.email}</span></span>
            <span className="rounded-full bg-canvas px-2.5 py-0.5 text-xs font-semibold capitalize">{m.role.toLowerCase()}</span>
            {canManage && m.role !== "OWNER" && (
              <button aria-label={`Remove ${m.email}`} className="text-muted-foreground hover:text-destructive" disabled={pending}
                onClick={() => start(async () => { const r = await removeTeamMember(businessId, m.user_id); if (r.ok) { toast.success(r.message); router.refresh(); } else toast.error(r.error); })}>
                <Trash2 className="size-4" />
              </button>
            )}
          </li>
        ))}
      </ul>
      {canManage && (planAllows ? (
        <form className="grid gap-2 sm:grid-cols-[1fr_160px_auto]" onSubmit={(e) => { e.preventDefault(); start(async () => {
          const r = await addTeamMember(businessId, email, role);
          if (r.ok) { toast.success(r.message); setEmail(""); router.refresh(); } else toast.error(r.error);
        }); }}>
          <Input type="email" required placeholder="teammate@email.com" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Email" />
          <NativeSelect value={role} onChange={(e) => setRole(e.target.value as typeof role)} aria-label="Role">
            <option value="STAFF">Staff — bookings & messages</option>
            <option value="MANAGER">Manager — + fleet & store</option>
          </NativeSelect>
          <Button type="submit" disabled={pending}>{pending && <Loader2 className="animate-spin" />} Add</Button>
        </form>
      ) : <p className="rounded-2xl bg-canvas p-3 text-sm">Multiple staff accounts are available on the Business plan.</p>)}
    </div>
  );
}
