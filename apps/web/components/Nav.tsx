"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export function Nav() {
  const path = usePathname();
  const [dark, setDark] = useState(false);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);
  return (
    <header className="sticky top-0 z-30 h-14 border-b border-line bg-surface/90 backdrop-blur">
      <nav
        aria-label="Primary"
        className="mx-auto flex h-full max-w-[1280px] items-center gap-3 px-4 sm:gap-6 sm:px-6"
      >
        <Link
          href="/"
          className="whitespace-nowrap font-display text-[16px] font-semibold tracking-tight sm:text-[17px]"
        >
          HealthReach <span style={{ color: "#20970B" }}>AI</span>
        </Link>
        <Link
          href="/new"
          className={`whitespace-nowrap text-[13px] sm:text-[14px] ${path === "/new" ? "link font-medium" : "text-secondary"}`}
        >
          New campaign
        </Link>
        <Link
          href="/campaigns"
          className={`whitespace-nowrap text-[13px] sm:text-[14px] ${path?.startsWith("/campaigns") ? "link font-medium" : "text-secondary"}`}
        >
          Campaigns
        </Link>
        <span className="flex-1" />
        <button
          type="button"
          onClick={() => setDark((v) => !v)}
          aria-pressed={dark}
          aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
          title={dark ? "Switch to light mode" : "Switch to dark mode"}
          className="inline-flex h-6 min-w-[24px] items-center justify-center rounded-input border border-line px-2 text-[13px]"
        >
          <span aria-hidden="true">{dark ? "☀" : "◐"}</span>
          <span className="hidden sm:inline">
            &nbsp;{dark ? "Light" : "Dark"}
          </span>
        </button>
      </nav>
    </header>
  );
}
