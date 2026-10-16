export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="card p-8 text-center">
      <h3 className="font-display text-[20px] font-semibold">{title}</h3>
      <p className="mx-auto mt-2 max-w-[52ch] text-[14px] text-secondary">
        {body}
      </p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`skeleton ${className}`} />;
}

export function ProgressStatus({
  steps,
  current,
}: {
  steps: string[];
  /** Index of the stage the user should work on next. May equal steps.length when all are done. */
  current: number;
}) {
  return (
    <ol
      aria-label="Progress"
      className="flex flex-wrap gap-2"
      aria-live="polite"
    >
      {steps.map((s, i) => {
        const done = i < current || current >= steps.length;
        const active = i === current && current < steps.length;
        return (
          <li
            key={s}
            aria-current={active ? "step" : undefined}
            className={`rounded-full border border-line px-3 py-1 text-[13px] ${done ? "bg-surface text-secondary" : active ? "btn-primary border-transparent" : "text-secondary"}`}
          >
            {done ? `✓ ${s}` : active ? `… ${s}` : s}
          </li>
        );
      })}
    </ol>
  );
}
