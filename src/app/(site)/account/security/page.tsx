import { redirect } from "next/navigation";

/** Password-reset emails land here (after /auth/callback); the form lives on the account page. */
export default function AccountSecurityPage() {
  redirect("/account?reset=1");
}
