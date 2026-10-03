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

  it("emails about a booking lead with the rental business's logo and name", () => {
    const logo = "https://example.supabase.co/storage/v1/object/public/media/b/x/logo.png";
    const branded = renderAppEmail("booking_confirmed", { ...EMAILS.booking_confirmed.sample, logo }, BASE).html;
    expect(branded).toContain(`src="${logo}"`);
    expect(branded).toContain(EMAILS.booking_confirmed.sample.businessName!);
    expect(branded).toContain('width="64" height="29" alt="13C"'); // 13C moves to the corner
    const toBusiness = renderAppEmail("contract_signed", EMAILS.contract_signed.sample, BASE).html;
    expect(toBusiness).toContain('width="96" height="43" alt="13C"');
    expect(toBusiness).not.toContain(logo);
  });

  it("booking_confirmed shows both signatures (inline images) and the attached PDF", () => {
    const sample = EMAILS.booking_confirmed.sample;
    const withImages = { ...sample, signatures: sample.signatures!.map((s, i) => ({ ...s, image: `cid:signature-${i}` })) };
    const { html, text } = renderAppEmail("booking_confirmed", withImages, BASE);
    expect(html).toContain('src="cid:signature-0"');
    expect(html).toContain("Signed Oct 7, 9:41 AM");
    expect(html).toContain("13C-7G2AXE-v1-signed.pdf");
    expect(html).toContain(" · 4 pages");
    expect(html.indexOf("cid:signature-0")).toBeLessThan(html.indexOf("Vehicle")); // right after the intro
    expect(text).toContain("Renter: Juan Dela Cruz, signed Oct 7, 9:41 AM");
    // Without images (e.g. older signatures) the names still show.
    expect(renderAppEmail("booking_confirmed", sample, BASE).html).toContain("Maria Santos");
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
