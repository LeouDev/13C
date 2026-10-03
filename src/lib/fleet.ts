import { formatDate, plural, todayManila } from "@/lib/format";

export type Due = { tone: "danger" | "warning" | "neutral"; label: string; urgent: boolean };

/** How soon a date-based item (registration, insurance, service) is due. Within 30 days counts as soon. */
export function dueOn(date: string | null | undefined, today = todayManila()): Due | null {
  if (!date) return null;
  const days = Math.round((Date.parse(date) - Date.parse(today)) / 86_400_000);
  if (days < 0) return { tone: "danger", label: `Overdue by ${plural(-days, "day")}`, urgent: true };
  if (days === 0) return { tone: "danger", label: "Due today", urgent: true };
  if (days <= 30) return { tone: "warning", label: `Due in ${plural(days, "day")}`, urgent: true };
  return { tone: "neutral", label: formatDate(date), urgent: false };
}

/** Service due by distance: within 1,000 km counts as soon. */
export function dueKm(next: number | null | undefined, odometer: number | null | undefined): Due | null {
  if (next == null || odometer == null) return null;
  const left = next - odometer;
  if (left <= 0) return { tone: "danger", label: `Overdue by ${(-left).toLocaleString("en-PH")} km`, urgent: true };
  if (left <= 1000) return { tone: "warning", label: `Due in ${left.toLocaleString("en-PH")} km`, urgent: true };
  return { tone: "neutral", label: `At ${next.toLocaleString("en-PH")} km`, urgent: false };
}
