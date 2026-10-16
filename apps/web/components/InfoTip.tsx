"use client";
import { useId, useState } from "react";

export function InfoTip({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <span className="relative inline-block">
      <button
        type="button"
        aria-expanded={open}
        aria-describedby={id}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
        className="link ml-1 inline-flex h-6 w-6 items-center justify-center rounded-full border border-line text-[12px]"
        aria-label={`More about ${label}`}
      >
        ?
      </button>
      {open && (
        <span
          id={id}
          role="tooltip"
          className="card absolute left-0 z-20 mt-1 w-64 max-w-[calc(100vw-3rem)] p-3 text-[13px] text-secondary shadow-lg"
        >
          {children}
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="link mt-2 block text-[13px]"
          >
            Close
          </button>
        </span>
      )}
    </span>
  );
}
