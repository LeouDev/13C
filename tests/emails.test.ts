/**
 * Every email renders cleanly. Supabase Auth templates are file snapshots in supabase/templates/
 * (regenerate with `npm run emails:build`, then `supabase config push`).
 */
import { describe, expect, it } from "vitest";
import { AUTH_EMAILS, EMAILS, renderAppEmail, renderAuthEmail, type EmailKey } from "@/emails";

const BASE = "https://13-c.vercel.app";

describe("app emails", () => {
  for (const key of Object.keys(EMAILS) as EmailKey[]) {
    it(key, () => {
      const { subject, html, text } = renderAppEmail(key, EMAILS[key].sample, BASE);
      expect(subject.length).toBeGreaterThan(5);
      for (const out of [subject, html, text]) expect(out).not.toMatch(/undefined|null|NaN|\[object Object\]/);
      expect(html).toContain(`${BASE}/assets/email-logo.png`);
      expect(html).toContain("<title>");
      expect(text.length).toBeGreaterThan(40);
      // every link is absolute
      for (const [, href] of html.matchAll(/href="([^"]+)"/g)) expect(href).toMatch(/^https:\/\//);
    });
  }

  it("escapes user-provided values", () => {
    const evil = '<script>alert("x")</script>';
    const { html, text } = renderAppEmail("booking_request", { ...EMAILS.booking_request.sample, customerName: evil, vehicle: `Vios ${evil}` }, BASE);
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(text).toContain(evil); // plain text isn't HTML
  });

  it("only accepts hex accent colors", () => {
    const { html } = renderAppEmail("contract_sent", { ...EMAILS.contract_sent.sample, accent: "red;background:url(x)" }, BASE);
    expect(html).not.toContain("url(x)");
  });
});

describe("Supabase auth templates", () => {
  for (const name of Object.keys(AUTH_EMAILS)) {
    it(name, async () => {
      const { html } = renderAuthEmail(name);
      expect(html).toContain("{{ .SiteURL }}/assets/email-logo.png");
      const required = name === "reauthentication" ? "{{ .Token }}" : AUTH_EMAILS[name]!.kind === "notification" ? "{{ .Email }}" : "{{ .ConfirmationURL }}";
      expect(html).toContain(required);
      await expect(html).toMatchFileSnapshot(`../supabase/templates/${name}.html`);
    });
  }
});
