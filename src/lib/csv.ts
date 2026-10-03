/**
 * RFC 4180 CSV with a UTF-8 BOM (Excel opens ₱ and ñ correctly). Cells that a spreadsheet would run as a
 * formula (=, +, -, @, tab, CR) get a leading apostrophe, so exported customer data can't execute.
 */
export function toCsv(rows: (string | number | null | undefined)[][]) {
  const cell = (v: string | number | null | undefined) => {
    if (v == null) return "";
    const s = typeof v === "number" ? String(v) : /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
    return /[",\r\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
  };
  return "﻿" + rows.map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
}
