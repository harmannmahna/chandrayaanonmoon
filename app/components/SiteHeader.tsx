"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const NAV = [
  { href: "/", label: "Register" },
  { href: "/context", label: "Context" },
];

function HeaderInner() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const walkthroughOpen = searchParams.get("walkthrough") === "1";
  const [open, setOpen] = useState(false);

  const openWalkthrough = () => {
    setOpen(false);
    router.push("/?walkthrough=1&step=0");
  };

  return (
    <header className="glass-header sticky top-0 z-50">
      <div className="mx-auto flex w-[min(1200px,94vw)] items-center justify-between gap-4 py-3.5">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href="/"
            className="mono shrink-0 text-sm font-semibold uppercase tracking-[0.14em] text-[var(--text-primary)]"
          >
            Luna<span className="text-[var(--accent-primary)]">/</span>Register
          </Link>
          <span className="badge-prototype hidden sm:inline">Prototype</span>
        </div>

        <nav className="nav-pill hidden items-center gap-1 md:flex" aria-label="Primary">
          {NAV.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-link ${active ? "nav-link-active" : ""}`}
              >
                {item.label}
              </Link>
            );
          })}
          <button
            type="button"
            onClick={openWalkthrough}
            className={`nav-link ${walkthroughOpen ? "nav-link-active" : ""}`}
          >
            How to demo
          </button>
        </nav>

        <div className="md:hidden">
          <button
            type="button"
            className="btn-ghost !min-h-9 !px-3"
            aria-expanded={open}
            aria-controls="mobile-nav"
            onClick={() => setOpen((value) => !value)}
          >
            {open ? "Close" : "Menu"}
          </button>
        </div>
      </div>

      {open ? (
        <div id="mobile-nav" className="border-t border-[var(--border)] md:hidden">
          <nav className="mx-auto flex w-[min(1200px,94vw)] flex-col gap-1 py-3" aria-label="Mobile">
            {NAV.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={`nav-link ${active ? "nav-link-active" : ""}`}
                >
                  {item.label}
                </Link>
              );
            })}
            <button type="button" onClick={openWalkthrough} className="nav-link text-left">
              How to demo
            </button>
          </nav>
        </div>
      ) : null}
    </header>
  );
}

export function SiteHeader() {
  return (
    <Suspense fallback={<div className="glass-header h-[60px]" />}>
      <HeaderInner />
    </Suspense>
  );
}
