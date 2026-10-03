const TZ = "Asia/Manila";

const php = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 });
const php2 = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", minimumFractionDigits: 2 });

export const formatPHP = (n: number | string | null | undefined, cents = false) =>
  (cents ? php2 : php).format(Number(n ?? 0));

export const formatDate = (d: string | Date, opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" }) =>
  new Intl.DateTimeFormat("en-PH", { timeZone: TZ, ...opts }).format(new Date(d));

export const formatDateTime = (d: string | Date) =>
  formatDate(d, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });

export const formatTime = (d: string | Date) => formatDate(d, { hour: "numeric", minute: "2-digit" });

export function formatRange(a: string | Date, b: string | Date) {
  const sameYear = new Date(a).getFullYear() === new Date(b).getFullYear();
  return `${formatDate(a, { month: "short", day: "numeric", ...(sameYear ? {} : { year: "numeric" }) })} – ${formatDate(b)}`;
}

export function timeAgo(d: string | Date) {
  const s = Math.round((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 7 * 86400) return `${Math.floor(s / 86400)}d ago`;
  return formatDate(d, { month: "short", day: "numeric" });
}

export function responseTimeLabel(minutes: number | null | undefined) {
  if (minutes == null) return null;
  if (minutes <= 15) return "within 15 minutes";
  if (minutes <= 60) return "within an hour";
  if (minutes <= 240) return "within a few hours";
  return "within a day";
}

/** "PAYMENT_ON_PICKUP" → "Payment on pickup" */
export const labelize = (s: string) =>
  ({ GCASH: "GCash", MAYA: "Maya", SUV: "SUV", MPV: "MPV", suv: "SUV", mpv: "MPV", gcash: "GCash", paymaya: "Maya", qrph: "QR Ph", grab_pay: "GrabPay" } as Record<string, string>)[s] ?? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase().replaceAll("_", " ");

export const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** Manila wall-clock date + time (from <input type=date/time>) → ISO instant. */
export function manilaToISO(date: string, time = "10:00") {
  return new Date(`${date}T${time}:00+08:00`).toISOString();
}

/** ISO instant → Manila "YYYY-MM-DD" for <input type=date>. */
export function isoToManilaDate(iso: string | Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
}

export function isoToManilaTime(iso: string | Date) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));
}

export function todayManila(offsetDays = 0) {
  return isoToManilaDate(new Date(Date.now() + offsetDays * 86400000));
}

export const initials = (name: string | null | undefined) =>
  (name ?? "?").split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join("") || "?";

/** ISO timestamp `days` from now (server render helper). */
export const isoDaysFromNow = (days: number) => new Date(Date.now() + days * 86400000).toISOString();

/**
 * A readable summary of a recorded user agent for the signature certificate, e.g. "Chrome 129 on Windows" or
 * "Safari on iPhone (iOS 18)". The full string stays the evidence; this is only a label.
 */
export function browserLabel(ua: string | null | undefined) {
  if (!ua) return null;
  const browsers: [RegExp, string][] = [[/Edg(?:A|iOS)?\/(\d+)/, "Edge"], [/OPR\/(\d+)/, "Opera"], [/SamsungBrowser\/(\d+)/, "Samsung Internet"],
    [/(?:Firefox|FxiOS)\/(\d+)/, "Firefox"], [/(?:CriOS|Chrome)\/(\d+)/, "Chrome"], [/Safari\//, "Safari"]];
  const hit = browsers.find(([re]) => re.test(ua));
  const ios = ua.match(/(iPhone|iPad).*? OS (\d+)_/);
  const android = ua.match(/Android (\d+)/);
  const os = ios ? `${ios[1]} (${ios[1] === "iPad" ? "iPadOS" : "iOS"} ${ios[2]})` : android ? `Android ${android[1]}`
    : /Windows/.test(ua) ? "Windows" : /CrOS/.test(ua) ? "ChromeOS" : /Mac OS X/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : null;
  if (!hit && !os) return ua.length > 60 ? `${ua.slice(0, 59)}…` : ua; // not a browser we recognise: show what was recorded
  const version = hit && hit[1] !== "Safari" ? ua.match(hit[0])?.[1] : undefined;
  const name = hit ? `${hit[1]}${version ? ` ${version}` : ""}` : "Browser";
  return os ? `${name} on ${os}` : name;
}
