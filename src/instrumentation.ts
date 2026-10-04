import type { Instrumentation } from "next";

/**
 * Server errors (pages, route handlers, server actions, proxy) go to app_errors. An hourly job emails admins
 * a summary (send_error_summary in supabase/migrations/20261004000035_app_errors.sql).
 * Redirects and not-found are navigation, not errors: Next.js doesn't report them here.
 */
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  try {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const e = (typeof error === "object" && error !== null ? error : {}) as { message?: unknown; digest?: unknown };
    await createAdminClient().from("app_errors").insert({
      message: String(e.message ?? error).slice(0, 500),
      digest: typeof e.digest === "string" ? e.digest : null,
      path: request.path.split("?")[0]!.slice(0, 300), // the query string can hold personal data
      method: request.method,
      route: `${context.routeType} ${context.routePath}`.slice(0, 300),
    });
  } catch (failure) {
    console.error("[errors] couldn't record a server error", failure);
  }
};
