import type { Metadata } from "next";
import Link from "next/link";
import { Mail, Monitor, Smartphone, Type } from "lucide-react";
import { cn } from "cn";
import { Pill } from "@/components/common/badges";
import { PageHeader } from "@/components/common/states";
import { AUTH_EMAILS, EMAILS, previewAuthHtml, renderAppEmail, renderAuthEmail, type EmailKey } from "@/emails";
import { SITE_URL } from "@/lib/constants";

export const metadata: Metadata = { title: "Emails" };

type Item = { id: string; group: string; subject: string; trigger: string; status: string; notificationType?: string };

const AUTH_GROUP = "Sign-in & security (Supabase)";
const items: Item[] = [
  ...Object.entries(AUTH_EMAILS).map(([name, a]) => ({
    id: `auth:${name}`, group: AUTH_GROUP, subject: a.email.subject, trigger: a.when, status: "Ready — install after custom SMTP",
  })),
  ...(Object.entries(EMAILS) as [EmailKey, (typeof EMAILS)[EmailKey]][]).map(([key, t]) => ({
    id: key, group: `${t.audience}s`, subject: renderAppEmail(key, t.sample).subject, trigger: t.trigger,
    status: "Ready — needs an email provider", notificationType: "notificationType" in t ? t.notificationType : undefined,
  })),
];
const GROUPS = [AUTH_GROUP, "Renters", "Businesses", "Admins"];

export default async function EmailsPage({ searchParams }: PageProps<"/admin/emails">) {
  const { id = items[0]!.id, w = "desktop", view = "html" } = (await searchParams) as { id?: string; w?: string; view?: string };
  const item = items.find((i) => i.id === id) ?? items[0]!;
  const rendered = item.id.startsWith("auth:")
    ? (() => { const r = renderAuthEmail(item.id.slice(5)); return { ...r, html: previewAuthHtml(r.html, SITE_URL), text: previewAuthHtml(r.text, SITE_URL) }; })()
    : renderAppEmail(item.id as EmailKey, EMAILS[item.id as EmailKey].sample);
  const q = (patch: Record<string, string>) => `?${new URLSearchParams({ id: item.id, w, view, ...patch })}`;

  return (
    <>
      <PageHeader title="Emails" description={`${items.length} branded emails. Previews use sample data; links point to ${SITE_URL.replace(/^https?:\/\//, "")}.`} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
        <nav className="grid content-start gap-5 rounded-2xl border bg-white p-3 lg:max-h-[calc(100svh-10rem)] lg:overflow-y-auto" aria-label="Emails">
          {GROUPS.map((g) => (
            <div key={g}>
              <p className="eyebrow px-2 pb-1 text-muted-foreground">{g}</p>
              <ul className="grid gap-0.5">
                {items.filter((i) => i.group === g).map((i) => (
                  <li key={i.id}>
                    <Link href={q({ id: i.id })} aria-current={i.id === item.id ? "page" : undefined}
                      className={cn("block rounded-xl px-3 py-2 text-sm", i.id === item.id ? "bg-navy-900 text-white" : "hover:bg-canvas")}>
                      <span className="block truncate font-medium">{i.subject}</span>
                      <span className={cn("block truncate text-xs", i.id === item.id ? "text-white/60" : "text-muted-foreground")}>{i.trigger}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <section className="min-w-0">
          <div className="mb-3 rounded-2xl border bg-white p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Mail className="size-4 text-electric" />
              <p className="font-semibold text-navy-900">{rendered.subject}</p>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{item.trigger}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Pill tone="warning">{item.status}</Pill>
              {item.notificationType && <Pill tone="info">notification: {item.notificationType}</Pill>}
              <Pill>{item.id.startsWith("auth:") ? `supabase/templates/${item.id.slice(5)}.html` : `src/emails/templates.ts → ${item.id}`}</Pill>
            </div>
          </div>
          <div className="mb-3 flex flex-wrap gap-1 rounded-full bg-white p-1 ring-1 ring-border sm:w-fit">
            {([["desktop", Monitor, "Desktop"], ["mobile", Smartphone, "Mobile"]] as const).map(([key, Icon, label]) => (
              <Link key={key} href={q({ w: key, view: "html" })} className={cn("flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold", view === "html" && w === key ? "bg-navy-900 text-white" : "text-navy-800")}><Icon className="size-3.5" />{label}</Link>
            ))}
            <Link href={q({ view: "text" })} className={cn("flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold", view === "text" ? "bg-navy-900 text-white" : "text-navy-800")}><Type className="size-3.5" />Plain text</Link>
          </div>
          {view === "text" ? (
            <pre className="overflow-x-auto rounded-2xl border bg-white p-5 text-sm whitespace-pre-wrap text-navy-900">{rendered.text}</pre>
          ) : (
            <div className="overflow-x-auto rounded-2xl border bg-[#eef0f4] p-3">
              <iframe title={`Preview: ${rendered.subject}`} srcDoc={rendered.html} sandbox="allow-popups allow-popups-to-escape-sandbox"
                className="mx-auto block h-[900px] rounded-xl border-0 bg-white" style={{ width: w === "mobile" ? 375 : 640, maxWidth: "100%" }} />
            </div>
          )}
        </section>
      </div>
    </>
  );
}
