type Violation = Record<string, unknown>;

/**
 * Content-Security-Policy violation reports (the policy is report-only for now, see next.config.ts).
 * Logs one compact line per violation so the policy can be tightened before it's enforced.
 */
export async function POST(request: Request) {
  const text = (await request.text()).slice(0, 16_000);
  let body: unknown;
  try { body = JSON.parse(text); } catch { return new Response(null, { status: 204 }); }
  // report-uri sends {"csp-report": {...}}; the Reporting API sends [{type: "csp-violation", body: {...}}].
  const reports: Violation[] = Array.isArray(body)
    ? body.filter((r) => r?.type === "csp-violation").map((r) => r.body as Violation)
    : [(body as { "csp-report"?: Violation })?.["csp-report"]].filter((r): r is Violation => !!r);
  for (const r of reports.slice(0, 10)) {
    console.warn("[csp]", JSON.stringify({
      directive: r.effectiveDirective ?? r["effective-directive"] ?? r["violated-directive"],
      blocked: r.blockedURL ?? r["blocked-uri"],
      page: r.documentURL ?? r["document-uri"],
      source: r.sourceFile ?? r["source-file"],
      line: r.lineNumber ?? r["line-number"],
    }));
  }
  return new Response(null, { status: 204 });
}
