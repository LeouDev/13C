import { redirect } from "next/navigation";

// Old link; the queue lives on the Businesses page.
export default function VerificationQueue() {
  redirect("/admin/businesses?status=queue");
}
