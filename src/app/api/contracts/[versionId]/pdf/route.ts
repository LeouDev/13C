import { NextResponse, type NextRequest } from "next/server";
import { renderContractPdf } from "@/lib/contracts/pdf";
import { contractPdfInput, finalizeSignedPdf, loadVersion } from "@/lib/contracts/service";
import { createClient } from "@/lib/supabase/server";

/**
 * Contract download. Access is decided by RLS on the user's own session:
 * signed versions → short-lived signed URL to the private stored PDF; unsigned → watermarked preview.
 */
export async function GET(request: NextRequest, ctx: RouteContext<"/api/contracts/[versionId]/pdf">) {
  const { versionId } = await ctx.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(request.nextUrl.pathname)}`, request.url));

  const version = await loadVersion(supabase, versionId);
  if (!version) return new NextResponse("Not found", { status: 404 });
  const filename = `${version.bookings?.reference ?? "13C-contract"}-v${version.version}${version.status === "SIGNED" ? "-signed" : "-draft"}.pdf`;

  if (version.status === "SIGNED") {
    const path = version.pdf_path ?? (await finalizeSignedPdf(version.id));
    if (!path) return new NextResponse("Not available", { status: 404 });
    const { data, error } = await supabase.storage.from("contracts").createSignedUrl(path, 60, { download: filename });
    if (error || !data) return new NextResponse("Not available", { status: 403 });
    return NextResponse.redirect(data.signedUrl);
  }

  const bytes = await renderContractPdf(await contractPdfInput(version));
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}
