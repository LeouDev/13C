/** Calendar cell styles shared by server (fleet calendar) and client (month calendar) components. */
export const KIND_STYLE: Record<string, { cell: string; dot: string; label: string }> = {
  BOOKED: { cell: "bg-navy-900 text-white", dot: "bg-navy-900", label: "Booked" },
  CONFIRMED: { cell: "bg-navy-900 text-white", dot: "bg-navy-900", label: "Booked" },
  PENDING: { cell: "bg-amber-100 text-amber-900", dot: "bg-amber-400", label: "Pending request" },
  BLOCKED: { cell: "bg-slate-200 text-slate-500 line-through", dot: "bg-slate-400", label: "Blocked" },
  MAINTENANCE: { cell: "bg-orange-100 text-orange-800", dot: "bg-orange-400", label: "Maintenance" },
  SELECTED: { cell: "bg-electric text-white", dot: "bg-electric", label: "Your dates" },
};
