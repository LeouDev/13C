import { redirect } from "next/navigation";

export default function VerificationQueue() {
  redirect("/admin/businesses?status=queue");
}
