/** The bookings CSV lists renters' contact details, so staff can't download it (owners and managers can). */
import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

const session = vi.hoisted(() => ({ role: "STAFF" as "OWNER" | "MANAGER" | "STAFF" }));
vi.mock("@/lib/auth", async (original) => ({
  ...(await original<typeof import("@/lib/auth")>()),
  requireBusiness: async () => ({ business: { id: "00000000-0000-0000-0000-000000000000", slug: "test" }, role: session.role }),
}));
vi.mock("@/lib/queries", () => ({ getSubscription: async () => ({ plan: "PRO", status: "ACTIVE", current_period_end: null }) }));

const { GET } = await import("@/app/dashboard/analytics/export/route");
const download = () => GET(new NextRequest("http://localhost/dashboard/analytics/export?days=30"));

describe("bookings CSV export", () => {
  it("is refused for staff", async () => {
    session.role = "STAFF";
    const res = await download();
    expect(res.status).toBe(403);
    expect(await res.text()).toMatch(/owners and managers/);
  });

  it("lets managers through to the plan check", async () => {
    session.role = "MANAGER";
    const res = await download();
    expect(res.status).toBe(403);
    expect(await res.text()).toMatch(/Business plan/);
  });
});
