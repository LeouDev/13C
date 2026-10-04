/** Shared layout for the Privacy Policy and Terms of Service. */
export function LegalDoc({
  title, updated, intro, toc, children,
}: {
  title: string;
  updated: string;
  intro: React.ReactNode;
  toc: { id: string; title: string }[];
  children: React.ReactNode;
}) {
  return (
    <article className="container-page max-w-3xl py-12">
      <p className="eyebrow text-electric">Legal</p>
      <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-navy-900 sm:text-4xl">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">Last updated {updated}</p>

      <div className="mt-8 text-[15px] leading-7 text-slate-700">{intro}</div>

      <nav aria-labelledby="toc-heading" className="mt-8 rounded-2xl bg-canvas p-5">
        <h2 id="toc-heading" className="text-sm font-semibold text-navy-900">Contents</h2>
        <ol className="mt-2 grid list-decimal gap-1 pl-5 text-sm sm:grid-cols-2 sm:gap-x-6">
          {toc.map((t) => <li key={t.id}><a href={`#${t.id}`} className="text-electric hover:underline">{t.title}</a></li>)}
        </ol>
      </nav>

      <div className="mt-10 grid gap-10">{children}</div>
    </article>
  );
}

export function LegalSection({ id, n, title, children }: { id: string; n: number; title: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-heading`} className="scroll-mt-24">
      <h2 id={`${id}-heading`} className="font-display text-xl font-bold tracking-tight text-navy-900 sm:text-2xl">
        {n}. {title}
      </h2>
      <div className="mt-3 grid gap-3 text-[15px] leading-7 text-slate-700 [&_a]:font-medium [&_a]:text-electric [&_a:hover]:underline [&_h3]:mt-2 [&_h3]:font-semibold [&_h3]:text-navy-900 [&_li]:pl-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_strong]:text-navy-900 [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5">
        {children}
      </div>
    </section>
  );
}
