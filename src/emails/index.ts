import { SITE_URL } from "@/lib/constants";
import { renderEmail } from "./layout";
import { EMAILS, type EmailData, type EmailKey } from "./templates";

export { EMAILS, type EmailData, type EmailKey } from "./templates";
export { AUTH_EMAILS, renderAuthEmail, previewAuthHtml } from "./auth";

/** Render an app email → { subject, html, text } ready for any email provider. */
export function renderAppEmail(key: EmailKey, data: EmailData, base = SITE_URL) {
  return renderEmail(EMAILS[key].build(data), { base });
}
