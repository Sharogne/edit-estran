export function StatusBadge({ status }: { status: string }) {
  const published = status === "published";
  return (
    <span
      data-cy="status-badge"
      data-status={status}
      className={
        published
          ? "rounded-md border border-accent/40 bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent-deep"
          : "rounded-md border border-line bg-surface px-2 py-0.5 text-xs font-medium text-ink-muted"
      }
    >
      {published ? "Publié" : "Brouillon"}
    </span>
  );
}
