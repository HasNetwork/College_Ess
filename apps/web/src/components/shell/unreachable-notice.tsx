/**
 * Shown by a signed-in page when the session couldn't be read because College Ess couldn't
 * be reached (offline, or a Wi-Fi login page answering instead). That is not a sign-out, so
 * the page stays and says why it is empty. An `<output>` is a live status for screen readers;
 * it holds phrasing content only, hence the spans.
 */
export function UnreachableNotice({ what }: { what: string }) {
  return (
    <output className="block max-w-4xl space-y-1 rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-5">
      <span className="block font-semibold text-[var(--text-primary)]">
        Can't reach College Ess
      </span>
      <span className="block text-sm text-[var(--text-secondary)]">
        {what} loads when College Ess can be reached. On campus Wi-Fi, open any website to sign in
        to the network first.
      </span>
    </output>
  );
}
