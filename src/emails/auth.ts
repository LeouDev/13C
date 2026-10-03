import { renderEmail, type Email } from "./layout";

/**
 * Supabase Auth emails, rendered with Go template variables and installed via
 * supabase/config.toml (`npm run emails:build`, then `supabase config push`).
 * Kept short with one call to action, per Supabase's deliverability guidance.
 */
export const AUTH_EMAILS: Record<string, { kind: "template" | "notification"; when: string; email: Email }> = {
  confirmation: {
    kind: "template",
    when: "A new account signs up",
    email: {
      subject: "Confirm your 13C account",
      preheader: "Confirm your email to finish creating your account.",
      heading: "Confirm your email",
      blocks: [{ p: "Tap the button below to confirm **{{ .Email }}** and finish creating your 13C account." }],
      cta: { label: "Confirm email", url: "{{ .ConfirmationURL }}" },
      footer: "auth",
    },
  },
  recovery: {
    kind: "template",
    when: "A user asks to reset their password",
    email: {
      subject: "Reset your 13C password",
      preheader: "Use this link to choose a new password.",
      heading: "Reset your password",
      blocks: [{ p: "We received a request to reset the password for **{{ .Email }}**. This link expires soon and can only be used once." }],
      cta: { label: "Choose a new password", url: "{{ .ConfirmationURL }}" },
      footer: "auth",
    },
  },
  email_change: {
    kind: "template",
    when: "A user changes their email address",
    email: {
      subject: "Confirm your new email address",
      preheader: "Confirm the change to your 13C sign-in email.",
      heading: "Confirm your new email",
      blocks: [{ p: "Confirm that you want to change your 13C email from **{{ .Email }}** to **{{ .NewEmail }}**." }],
      cta: { label: "Confirm new email", url: "{{ .ConfirmationURL }}" },
      footer: "auth",
    },
  },
  magic_link: {
    kind: "template",
    when: "A user requests a sign-in link",
    email: {
      subject: "Your 13C sign-in link",
      preheader: "Sign in to 13C with one tap.",
      heading: "Sign in to 13C",
      blocks: [{ p: "Use this link to sign in. It expires soon and can only be used once." }, { p: "Or enter this code:" }, { code: "{{ .Token }}" }],
      cta: { label: "Sign in", url: "{{ .ConfirmationURL }}" },
      footer: "auth",
    },
  },
  invite: {
    kind: "template",
    when: "An admin invites someone from the Supabase dashboard",
    email: {
      subject: "You're invited to 13C",
      preheader: "Accept your invitation to create your account.",
      heading: "You're invited to 13C",
      blocks: [{ p: "You've been invited to create a 13C account for **{{ .Email }}**." }],
      cta: { label: "Accept invitation", url: "{{ .ConfirmationURL }}" },
      footer: "auth",
    },
  },
  reauthentication: {
    kind: "template",
    when: "A user confirms a sensitive change",
    email: {
      subject: "Your 13C verification code",
      preheader: "Enter this code to continue.",
      heading: "Your verification code",
      blocks: [{ p: "Enter this code to confirm it's you:" }, { code: "{{ .Token }}" }, { p: "If you didn't try to make a change, you can ignore this email." }],
      footer: "auth",
    },
  },
  password_changed: {
    kind: "notification",
    when: "A user's password was changed",
    email: {
      subject: "Your 13C password was changed",
      preheader: "If this wasn't you, reset your password now.",
      heading: "Your password was changed",
      blocks: [
        { p: "The password for **{{ .Email }}** was just changed." },
        { note: "If you didn't do this, reset your password immediately and contact support@air-rally.com.", tone: "warning" },
      ],
      cta: { label: "Go to sign in", url: "{{ .SiteURL }}/login" },
      footer: "auth",
    },
  },
  email_changed: {
    kind: "notification",
    when: "A user's email address was changed",
    email: {
      subject: "Your 13C email address was changed",
      preheader: "If this wasn't you, contact support now.",
      heading: "Your email address was changed",
      blocks: [
        { p: "The email for your 13C account was changed from **{{ .OldEmail }}** to **{{ .Email }}**." },
        { note: "If you didn't do this, contact support@air-rally.com immediately.", tone: "warning" },
      ],
      footer: "auth",
    },
  },
};

export const renderAuthEmail = (name: string) => renderEmail(AUTH_EMAILS[name]!.email, { base: "{{ .SiteURL }}" });

/** Sample values for previewing the Go templates. */
export function previewAuthHtml(html: string, siteUrl: string) {
  return html
    .replaceAll("{{ .SiteURL }}", siteUrl)
    .replaceAll("{{ .ConfirmationURL }}", `${siteUrl}/auth/callback?code=preview`)
    .replaceAll("{{ .Token }}", "482915")
    .replaceAll("{{ .Email }}", "juan@example.com")
    .replaceAll("{{ .NewEmail }}", "juan.delacruz@example.com")
    .replaceAll("{{ .OldEmail }}", "juan@example.com");
}
