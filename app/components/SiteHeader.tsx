"use client";

import Link from "next/link";
import { Suspense } from "react";
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

  const openWalkthrough = () => {
    router.push("/?walkthrough=1&step=0");
  };

  return (
    <header className="glass-header sticky top-0 z-40">
      <div className="mx-auto flex w-[min(1200px,92vw)] flex-col gap-3 py-4 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <Link href="/" className="mono text-sm font-semibold tracking-[0.08em] text-[var(--text-primary)]">
              LUNA<span className="text-[var(--accent-primary)]">/</span>REGISTER
            </Link>
            <span className="badge-prototype hidden md:inline">Prototype</span>
          </div>
          <p className="muted mt-2 max-w-3xl text-sm">
            Multi-modal lunar image registration with sub-pixel refinement and coverage-aware matching.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <nav className="nav-pill">
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
          </nav>
          <button
            type="button"
            onClick={openWalkthrough}
            className={walkthroughOpen ? "btn-primary" : "btn-secondary"}
          >
            How to demo
          </button>
        </div>
      </div>
    </header>
  );
}

export function SiteHeader() {
  return (
    <Suspense fallback={<div className="glass-header h-[88px]" />}>
      <HeaderInner />
    </Suspense>
  );
}
