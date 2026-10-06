import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { watermark } from "@/lib/watermark";

/**
 * A renter's license or ID. Who may see it is decided by RLS on driver_documents as the viewer (the renter, admins, or a
 * business with a booking from them in progress). Businesses get it stamped with their name, the booking and the date;
 * they can't download the originals (the kyc storage policy), so this is the only copy they get.
 */
export async function GET(_: Request, ctx: RouteContext<"/api/renter-documents/[id]">) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user?.twoStepPassed) return new NextResponse("Sign in to view this document.", { status: 401 });
  const supabase = await createClient();
  const { data: doc } = await supabase.from("driver_documents").select("user_id, doc_type, storage_path").eq("id", id).maybeSingle();
  if (!doc) return new NextResponse("Not found", { status: 404 });
  const { data: file } = await createAdminClient().storage.from("kyc").download(doc.storage_path);
  if (!file) return new NextResponse("Not found", { status: 404 });
  const bytes = new Uint8Array(await file.arrayBuffer());
  const headers = { "cache-control": "private, no-store", "x-content-type-options": "nosniff" };
  if (doc.user_id === user.id || user.is_admin) {
    return new NextResponse(Buffer.from(bytes), { headers: { ...headers, "content-type": file.type || "application/octet-stream" } });
  }

  // The viewer's own business booking with this renter (RLS only returns those)
  const { data: booking } = await supabase.from("bookings").select("reference, businesses(name)").eq("renter_id", doc.user_id)
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  const stamp = [`For ${booking?.businesses?.name ?? "this booking"} only`, booking?.reference, formatDate(new Date()), "13C"].filter(Boolean).join(" - ");
  const pdf = await watermark(bytes, stamp).catch(() => null);
  if (!pdf) return new NextResponse("This file can't be shown here. Ask the renter to upload it again from their profile.", { status: 415 });
  return new NextResponse(Buffer.from(pdf), {
    headers: { ...headers, "content-type": "application/pdf", "content-disposition": `inline; filename="${doc.doc_type.toLowerCase()}.pdf"` },
  });
}
