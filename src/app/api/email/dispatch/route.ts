import { timingSafeEqual } from "node:crypto";
import { after, NextResponse } from "next/server";
import { emailEnabled } from "@/lib/mailer";
import { dispatchNotificationEmails } from "@/lib/notification-email";

export const maxDuration = 60;

const matches = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/** Called by the database (pg_net) when notifications are inserted, and every 5 minutes for retries. */
export async function POST(request: Request) {
  const secret = process.env.EMAIL_DISPATCH_SECRET;
  if (!secret || !matches(request.headers.get("authorization") ?? "", `Bearer ${secret}`)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!emailEnabled()) return NextResponse.json({ error: "Email isn't configured" }, { status: 503 });
  // Answer right away; sending continues after the response.
  after(async () => {
    try {
      const stats = await dispatchNotificationEmails();
      if (stats.sent || stats.failed) console.log("[email] dispatch", stats);
    } catch (e) {
      console.error("[email] dispatch failed", e);
    }
  });
  return NextResponse.json({ accepted: true }, { status: 202 });
}
