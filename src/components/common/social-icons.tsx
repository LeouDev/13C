/** Minimal brand glyphs (lucide no longer ships brand icons). */
export function FacebookIcon({ className }: { className?: string }) {
  return <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden><path d="M14 8.5V6.8c0-.8.5-1 .9-1h2.4V2.1L14 2c-3.6 0-4.4 2.7-4.4 4.4v2.1H7.5v3.8h2.1V22H14v-9.7h2.9l.4-3.8z" /></svg>;
}
export function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="0.6" fill="currentColor" />
    </svg>
  );
}
