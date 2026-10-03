"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { startConversation } from "@/app/actions/messages";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

type Props = {
  businessId: string;
  businessName: string;
  vehicleId?: string | null;
  vehicleName?: string;
  signedIn: boolean;
  returnTo: string;
  label?: string;
  className?: string;
  variant?: "default" | "outline" | "light" | "electric";
};

export function MessageButton({ businessId, businessName, vehicleId = null, vehicleName, signedIn, returnTo, label = "Message Us", className, variant = "outline" }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(vehicleName ? `Hi! Is the ${vehicleName} available on ` : "Hi! ");
  const [pending, start] = useTransition();

  if (!signedIn) {
    return (
      <Link href={`/login?next=${encodeURIComponent(returnTo)}`} className={buttonVariants({ variant, size: "xl", className })}>
        <MessageCircle /> {label}
      </Link>
    );
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant={variant} size="xl" className={className} />}>
        <MessageCircle /> {label}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Message {businessName}</DialogTitle>
          <DialogDescription>{vehicleName ? `About the ${vehicleName}. ` : ""}Ask about availability, delivery, drivers or requirements.</DialogDescription>
        </DialogHeader>
        <Textarea autoFocus rows={5} value={text} onChange={(e) => setText(e.target.value)} maxLength={4000} aria-label="Your message" />
        <Button size="xl" disabled={pending || text.trim().length < 2} style={{ background: "var(--store-accent)" }} className="text-white"
          onClick={() => start(async () => {
            const r = await startConversation(businessId, vehicleId, text);
            if (r.ok && r.data) { toast.success("Message sent"); router.push(`/account/messages/${r.data.id}`); }
            else if (!r.ok) toast.error(r.error);
          })}>
          {pending && <Loader2 className="animate-spin" />} Send message
        </Button>
      </DialogContent>
    </Dialog>
  );
}
